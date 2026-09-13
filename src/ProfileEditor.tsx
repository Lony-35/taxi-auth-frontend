import { useEffect, useMemo, useState } from 'react'
import {
  UserCheckState,
  UserRole,
  useAuth,
  type AuthUser,
  type DriverCar,
  type ProfileDocumentChange,
} from './auth'
import JSONForm from './JSONForm'
import { fallbackProfileFields, readConfiguredFields, taxiFormAdapter } from './forms/config'

interface ProfileEditorProps { user: AuthUser; onClose: () => void }
type FileTuple = [unknown, Blob]

function ids(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch { return [] }
}

function files(value: unknown): Blob[] {
  if (!Array.isArray(value)) return []
  return (value as FileTuple[]).map(item => item?.[1]).filter((item): item is Blob => item instanceof Blob)
}

export default function ProfileEditor({ user, onClose }: ProfileEditorProps) {
  const { state, updateProfile, getAuthorizedCars } = useAuth()
  const [message, setMessage] = useState('')
  const [avatar, setAvatar] = useState<Blob>()
  const [car, setCar] = useState<DriverCar | null>(null)
  const isDriver = user.u_role === UserRole.Driver
  const driverCanEditIdentity = isDriver && (!user.u_check_state || user.u_check_state === UserCheckState.Required)
  const driverIsActive = isDriver && user.u_check_state === UserCheckState.Active

  useEffect(() => {
    if (!isDriver) return
    void getAuthorizedCars().then(cars => setCar(cars[0] ?? null))
  }, [isDriver])

  const fields = useMemo(() => {
    try { return readConfiguredFields('form_profile', fallbackProfileFields) }
    catch { return fallbackProfileFields }
  }, [user])

  const submit = async (submitted: Record<string, unknown>) => {
    setMessage('')
    const values = { ...submitted }
    const documents: Partial<Record<'passport_photo' | 'driver_license_photo', ProfileDocumentChange>> = {}
    if (driverCanEditIdentity) {
      documents.passport_photo = {
        existingIds: ids(user.u_details?.passport_photo),
        files: files(values.passport_photo),
      }
      documents.driver_license_photo = {
        existingIds: ids(user.u_details?.driver_license_photo),
        files: files(values.driver_license_photo),
      }
    }
    delete values.passport_photo
    delete values.driver_license_photo
    delete values.u_car

    try {
      await updateProfile({
        values,
        schemaFields: fields.flatMap(field => field.name ? [field.name] : []),
        avatar,
        documents: driverCanEditIdentity ? documents : undefined,
        car: car ?? undefined,
      })
      setMessage('Учётные данные обновлены.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить изменения.')
    }
  }

  return (
    <div className="profile-editor">
      <h2>Редактирование учётных данных</h2>
      <label>Аватар<input type="file" accept="image/*" onChange={event => setAvatar(event.currentTarget.files?.[0])} /></label>

      <JSONForm
        fields={fields}
        adapter={taxiFormAdapter()}
        defaultValues={user}
        onSubmit={values => void submit(values)}
        state={{ pending: state.status === 'loading' }}
      />

      {driverIsActive && car && (
        <section className="taxi-profile-domain" aria-label="Автомобиль водителя">
          <h2>Автомобиль</h2>
          <div className="form-grid">
            <label>ID модели<input value={car.cm_id} onChange={event => setCar({ ...car, cm_id: event.target.value })} /></label>
            <label>Мест<input type="number" min="1" max="20" value={car.seats} onChange={event => setCar({ ...car, seats: Number(event.target.value) })} /></label>
            <label>Госномер<input value={car.registration_plate} onChange={event => setCar({ ...car, registration_plate: event.target.value })} /></label>
            <label>Цвет<input value={car.color} onChange={event => setCar({ ...car, color: event.target.value })} /></label>
            <label>ID класса<input value={car.cc_id} onChange={event => setCar({ ...car, cc_id: event.target.value })} /></label>
          </div>
        </section>
      )}

      {message && <div className={message === 'Учётные данные обновлены.' ? 'notice' : 'alert'}>{message}</div>}
      <button className="button secondary" type="button" onClick={onClose}>Закрыть</button>
    </div>
  )
}
