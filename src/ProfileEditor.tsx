import { type FormEvent, useEffect, useState } from 'react'
import {
  UserCheckState,
  UserRole,
  useAuth,
  type AuthUser,
  type DriverCar,
} from './auth'

interface ProfileEditorProps {
  user: AuthUser
  onClose: () => void
}

function ids(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export default function ProfileEditor({ user, onClose }: ProfileEditorProps) {
  const { state, updateProfile, getAuthorizedCars } = useAuth()
  const [values, setValues] = useState<Record<string, string | boolean>>({
    u_name: user.u_name ?? '',
    u_family: user.u_family ?? '',
    u_middle: user.u_middle ?? '',
    u_phone: user.u_phone ?? '',
    u_email: user.u_email ?? '',
    u_city: user.u_city ?? '',
    u_lang: user.u_lang ?? '',
    u_currency: user.u_currency ?? '',
    u_lang_skills: user.u_lang_skills ?? '',
    u_description: user.u_description ?? '',
    u_birthday: user.u_birthday?.slice(0, 10) ?? '',
    u_gps_software: user.u_gps_software ?? '',
    u_active: user.u_active ?? false,
    ref_code: user.ref_code ?? '',
    out_drive: Boolean(user.out_drive),
    out_address: String(user.out_address ?? ''),
    out_s_address: String(user.out_s_address ?? ''),
    out_latitude: String(user.out_latitude ?? ''),
    out_longitude: String(user.out_longitude ?? ''),
    out_s_latitude: String(user.out_s_latitude ?? ''),
    out_s_longitude: String(user.out_s_longitude ?? ''),
    out_est_datetime: String(user.out_est_datetime ?? ''),
    out_passengers: String(user.out_passengers ?? ''),
    out_luggage: String(user.out_luggage ?? ''),
  })
  const [avatar, setAvatar] = useState<Blob>()
  const [passportFiles, setPassportFiles] = useState<Blob[]>([])
  const [licenseFiles, setLicenseFiles] = useState<Blob[]>([])
  const [car, setCar] = useState<DriverCar | null>(null)
  const [message, setMessage] = useState('')

  const isDriver = user.u_role === UserRole.Driver
  const driverCanEditIdentity = isDriver && (
    !user.u_check_state || user.u_check_state === UserCheckState.Required
  )
  const driverIsActive = isDriver && user.u_check_state === UserCheckState.Active

  useEffect(() => {
    if (!isDriver) return
    void getAuthorizedCars().then(cars => setCar(cars[0] ?? null))
  }, [isDriver])

  const set = (key: string, value: string | boolean) => {
    setValues(current => ({ ...current, [key]: value }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    try {
      await updateProfile({
        values,
        avatar,
        documents: driverCanEditIdentity ? {
          passport_photo: {
            existingIds: ids(user.u_details?.passport_photo),
            files: passportFiles,
          },
          driver_license_photo: {
            existingIds: ids(user.u_details?.driver_license_photo),
            files: licenseFiles,
          },
        } : undefined,
        car: car ?? undefined,
      })
      setMessage('Учётные данные обновлены.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить изменения.')
    }
  }

  return (
    <form className="profile-editor" onSubmit={submit}>
      <h2>Редактирование учётных данных</h2>

      {(user.u_role === UserRole.Client || driverCanEditIdentity) && <div className="form-grid">
        <label>Имя<input value={String(values.u_name)} onChange={event => set('u_name', event.target.value)} /></label>
        <label>Фамилия<input value={String(values.u_family)} onChange={event => set('u_family', event.target.value)} /></label>
        <label>Отчество<input value={String(values.u_middle)} onChange={event => set('u_middle', event.target.value)} /></label>
        <label>Телефон<input value={String(values.u_phone)} onChange={event => set('u_phone', event.target.value)} /></label>
        <label>Email<input type="email" value={String(values.u_email)} onChange={event => set('u_email', event.target.value)} /></label>
        {driverCanEditIdentity && <>
          <label>Город<input value={String(values.u_city)} onChange={event => set('u_city', event.target.value)} /></label>
          <label>Языки<input value={String(values.u_lang_skills)} onChange={event => set('u_lang_skills', event.target.value)} /></label>
          <label>Дата рождения<input type="date" value={String(values.u_birthday)} onChange={event => set('u_birthday', event.target.value)} /></label>
          <label className="span-2">О себе<textarea value={String(values.u_description)} onChange={event => set('u_description', event.target.value)} /></label>
        </>}
      </div>}

      <div className="form-grid">
        {(user.u_role === UserRole.Client || driverIsActive) && <>
          <label>Язык<input value={String(values.u_lang)} onChange={event => set('u_lang', event.target.value)} /></label>
          <label>Валюта<input value={String(values.u_currency)} onChange={event => set('u_currency', event.target.value)} /></label>
        </>}
        <label>Промокод<input value={String(values.ref_code)} onChange={event => set('ref_code', event.target.value)} /></label>
        <label>Аватар<input type="file" accept="image/*" onChange={event => setAvatar(event.currentTarget.files?.[0])} /></label>
      </div>

      {driverCanEditIdentity && <div className="form-grid files">
        <label>Новые фото паспорта<input type="file" accept="image/png,image/jpeg" multiple onChange={event => setPassportFiles(Array.from(event.currentTarget.files ?? []))} /></label>
        <label>Новые фото водительского удостоверения<input type="file" accept="image/png,image/jpeg" multiple onChange={event => setLicenseFiles(Array.from(event.currentTarget.files ?? []))} /></label>
      </div>}

      {driverIsActive && <>
        <h2>Рабочие настройки водителя</h2>
        <div className="form-grid">
          <label>Навигация<input value={String(values.u_gps_software)} onChange={event => set('u_gps_software', event.target.value)} /></label>
          <label className="inline-check"><input type="checkbox" checked={Boolean(values.u_active)} onChange={event => set('u_active', event.target.checked)} />Активен</label>
          <label className="inline-check"><input type="checkbox" checked={Boolean(values.out_drive)} onChange={event => set('out_drive', event.target.checked)} />Поездка вне сервиса</label>
          <label>Адрес отправления<input value={String(values.out_s_address)} onChange={event => set('out_s_address', event.target.value)} /></label>
          <label>Адрес назначения<input value={String(values.out_address)} onChange={event => set('out_address', event.target.value)} /></label>
          <label>Широта отправления<input inputMode="decimal" value={String(values.out_s_latitude)} onChange={event => set('out_s_latitude', event.target.value)} /></label>
          <label>Долгота отправления<input inputMode="decimal" value={String(values.out_s_longitude)} onChange={event => set('out_s_longitude', event.target.value)} /></label>
          <label>Широта назначения<input inputMode="decimal" value={String(values.out_latitude)} onChange={event => set('out_latitude', event.target.value)} /></label>
          <label>Долгота назначения<input inputMode="decimal" value={String(values.out_longitude)} onChange={event => set('out_longitude', event.target.value)} /></label>
          <label>Время завершения<input type="datetime-local" value={String(values.out_est_datetime)} onChange={event => set('out_est_datetime', event.target.value)} /></label>
          <label>Пассажиров<input type="number" value={String(values.out_passengers)} onChange={event => set('out_passengers', event.target.value)} /></label>
          <label>Багаж<input type="number" value={String(values.out_luggage)} onChange={event => set('out_luggage', event.target.value)} /></label>
        </div>
      </>}

      {isDriver && car && <>
        <h2>Автомобиль</h2>
        <div className="form-grid">
          <label>ID модели<input value={car.cm_id} onChange={event => setCar({ ...car, cm_id: event.target.value })} /></label>
          <label>Мест<input type="number" min="1" max="20" value={car.seats} onChange={event => setCar({ ...car, seats: Number(event.target.value) })} /></label>
          <label>Госномер<input value={car.registration_plate} onChange={event => setCar({ ...car, registration_plate: event.target.value })} /></label>
          <label>Цвет<input value={car.color} onChange={event => setCar({ ...car, color: event.target.value })} /></label>
          <label>ID класса<input value={car.cc_id} onChange={event => setCar({ ...car, cc_id: event.target.value })} /></label>
        </div>
      </>}

      {message && <div className={message === 'Учётные данные обновлены.' ? 'notice' : 'alert'}>{message}</div>}
      <div className="actions">
        <button className="button" type="submit" disabled={state.status === 'loading'}>Сохранить</button>
        <button className="button secondary" type="button" onClick={onClose}>Закрыть</button>
      </div>
    </form>
  )
}
