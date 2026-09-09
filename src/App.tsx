import { type FormEvent, useMemo, useState } from 'react'
import {
  useAuth,
  UserRole,
  type DriverCarRequest,
  type RegistrationType,
  type RegistrationUpload,
} from './auth'
import ProfileEditor from './ProfileEditor'

interface AppProps { useMock: boolean }
type Tab = 'login' | 'register'

const emailPattern = /^(([^<>()\[\].,;:\s@"]+(\.[^<>()\[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i
const phonePattern = /^[+]?\d{1,3}[(]?\d{3}[)]?[-\s.]?\d{3}[-\s.]?\d{3,6}$/i

function selectedFiles(input: HTMLInputElement, name: RegistrationUpload['name']): RegistrationUpload[] {
  return Array.from(input.files ?? []).map(file => ({ name, file }))
}

export default function App({ useMock }: AppProps) {
  const { state, login, register, remindPassword, checkReferralCode, logout, clearError } = useAuth()
  const [tab, setTab] = useState<Tab>('login')
  const [notice, setNotice] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [loginValue, setLoginValue] = useState(useMock ? 'demo@example.com' : '')
  const [password, setPassword] = useState(useMock ? 'demo' : '')
  const [registrationType, setRegistrationType] = useState<RegistrationType>('e-mail')
  const [role, setRole] = useState<UserRole>(UserRole.Client)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [street, setStreet] = useState('')
  const [region, setRegion] = useState('')
  const [card, setCard] = useState('')
  const [refCode, setRefCode] = useState('')
  const [workType, setWorkType] = useState('0')
  const [uploads, setUploads] = useState<RegistrationUpload[]>([])
  const [car, setCar] = useState<DriverCarRequest>({
    cm_id: '', seats: 4, registration_plate: '', color: '', cc_id: '', details: {},
  })

  const loading = state.status === 'loading'
  const isDriver = role === UserRole.Driver
  const loginType: RegistrationType = loginValue.includes('@') ? 'e-mail' : 'phone'
  const validationError = useMemo(() => {
    if (tab === 'login') {
      if (loginType === 'e-mail' && loginValue && !emailPattern.test(loginValue)) return 'Email указан неверно'
      if (loginType === 'phone' && loginValue && !phonePattern.test(loginValue)) return 'Телефон указан неверно'
      return ''
    }
    if (registrationType === 'e-mail' && email && !emailPattern.test(email)) return 'Email должен содержать домен, например name@example.com'
    if (registrationType === 'phone' && phone && !phonePattern.test(phone)) return 'Телефон указан неверно'
    if (card && !/^\d{16}$/.test(card)) return 'Номер карты должен содержать 16 цифр'
    return ''
  }, [tab, loginType, loginValue, registrationType, email, phone, card])

  const switchTab = (next: Tab) => {
    clearError()
    setNotice('')
    setTab(next)
  }

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault()
    if (validationError) return
    setNotice('')
    try {
      await login({ login: loginValue.trim(), password, type: loginType })
    } catch {
      // Ошибка уже находится в AuthStore.
    }
  }

  const restorePassword = async () => {
    if (!emailPattern.test(loginValue)) {
      setNotice('Для восстановления пароля укажите корректный email в поле логина.')
      return
    }
    try {
      await remindPassword(loginValue.trim())
      setNotice('Инструкция по восстановлению пароля отправлена на email.')
    } catch {
      setNotice('Не удалось отправить письмо. Проверьте адрес и попробуйте ещё раз.')
    }
  }

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault()
    if (validationError) return
    setNotice('')
    try {
      if (refCode.trim()) {
        const referral = await checkReferralCode(refCode.trim())
        if (!referral.exists) {
          setNotice('Промокод не найден.')
          return
        }
      }
      const result = await register({
        u_name: name.trim(),
        u_email: email.trim() || undefined,
        u_phone: phone.trim() || undefined,
        u_role: role,
        u_city: city.trim() || undefined,
        ref_code: refCode.trim() || undefined,
        u_details: isDriver ? {
          work_type: Number(workType), street: street.trim() || undefined,
          state: region.trim() || undefined, card: card.trim() || undefined,
        } : undefined,
        uploads: isDriver ? uploads : undefined,
        u_car: isDriver ? car : undefined,
      })
      setNotice(result.generatedPassword
        ? `Регистрация завершена. Пароль, созданный сервером: ${result.generatedPassword}`
        : 'Регистрация завершена.')
    } catch {
      // Ошибка уже находится в AuthStore.
    }
  }

  const replaceUploads = (name: RegistrationUpload['name'], input: HTMLInputElement) => {
    setUploads(current => [
      ...current.filter(item => item.name !== name),
      ...selectedFiles(input, name),
    ])
  }

  if (state.user) {
    if (editingProfile) {
      return (
        <main className="shell single">
          <section className="card wide-card profile-edit-card">
            <ProfileEditor user={state.user} onClose={() => setEditingProfile(false)} />
          </section>
        </main>
      )
    }
    return (
      <main className="shell single"><section className="card profile-card">
        <div className="success-mark" aria-hidden="true">✓</div>
        <p className="eyebrow">Сессия активна</p>
        <h1>Здравствуйте, {state.user.u_name || 'пользователь'}</h1>
        <dl className="profile-data">
          <div><dt>ID</dt><dd>{state.user.u_id}</dd></div>
          <div><dt>Email</dt><dd>{state.user.u_email || 'не указан'}</dd></div>
          <div><dt>Телефон</dt><dd>{state.user.u_phone || 'не указан'}</dd></div>
          <div><dt>Роль</dt><dd>{state.user.u_role === UserRole.Driver ? 'Водитель' : 'Клиент'}</dd></div>
        </dl>
        <div className="actions">
          <button className="button" onClick={() => setEditingProfile(true)}>Редактировать</button>
          <button className="button secondary" disabled={loading} onClick={() => void logout()}>Выйти</button>
        </div>
      </section></main>
    )
  }

  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">React + TypeScript</p>
        <h1>Отдельный модуль авторизации taxi</h1>
        <p>Вход, восстановление сессии, регистрация клиента и водителя, документы, автомобиль, промокод и восстановление пароля.</p>
        <ul>
          <li>совместимость с существующим API taxi</li>
          <li>Google и WhatsApp исключены по ТЗ</li>
          <li>API, состояние и хранилище не зависят от UI</li>
        </ul>
      </section>

      <section className={`card ${tab === 'register' && isDriver ? 'wide-card' : ''}`}>
        <div className="mode-row"><span className={`status-dot ${useMock ? 'mock' : 'live'}`} />{useMock ? 'Автономный demo-режим' : 'Подключён реальный API'}</div>
        <div className="tabs" role="tablist" aria-label="Авторизация">
          <button className={tab === 'login' ? 'active' : ''} onClick={() => switchTab('login')}>Вход</button>
          <button className={tab === 'register' ? 'active' : ''} onClick={() => switchTab('register')}>Регистрация</button>
        </div>
        {(state.error || validationError || notice) && <div className={state.error || validationError ? 'alert' : 'notice'} role="status">{state.error || validationError || notice}</div>}

        {tab === 'login' ? (
          <form onSubmit={submitLogin}>
            <label>Email или телефон<input autoComplete="username" value={loginValue} onChange={event => setLoginValue(event.target.value)} required /></label>
            <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
            <button className="link-button" type="button" onClick={() => void restorePassword()}>Восстановить пароль</button>
            <button className="button" type="submit" disabled={loading || Boolean(validationError)}>{loading ? 'Выполняется…' : 'Войти'}</button>
            {useMock && <p className="hint">Demo: demo@example.com / demo</p>}
          </form>
        ) : (
          <form onSubmit={submitRegister}>
            <fieldset className="segmented"><legend>Роль</legend>
              <label><input type="radio" checked={role === UserRole.Client} onChange={() => setRole(UserRole.Client)} />Клиент</label>
              <label><input type="radio" checked={role === UserRole.Driver} onChange={() => setRole(UserRole.Driver)} />Водитель</label>
            </fieldset>
            <fieldset className="segmented"><legend>Способ регистрации</legend>
              <label><input type="radio" checked={registrationType === 'e-mail'} onChange={() => setRegistrationType('e-mail')} />Email</label>
              <label><input type="radio" checked={registrationType === 'phone'} onChange={() => setRegistrationType('phone')} />Телефон</label>
            </fieldset>
            <div className="form-grid">
              <label>Имя<input value={name} onChange={event => setName(event.target.value)} required /></label>
              <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required={registrationType === 'e-mail'} /></label>
              <label>Телефон<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} required={registrationType === 'phone'} /></label>
              <label>Промокод <span className="optional">необязательно</span><input value={refCode} onChange={event => setRefCode(event.target.value)} /></label>
            </div>

            {isDriver && <>
              <h2>Данные водителя</h2>
              <div className="form-grid">
                <label>Тип работы<select value={workType} onChange={event => setWorkType(event.target.value)}><option value="0">Самозанятый</option><option value="1">Компания</option></select></label>
                <label>Город<input value={city} onChange={event => setCity(event.target.value)} /></label>
                <label>Улица<input value={street} onChange={event => setStreet(event.target.value)} /></label>
                <label>Регион / штат<input value={region} onChange={event => setRegion(event.target.value)} /></label>
                <label>Номер карты<input inputMode="numeric" value={card} onChange={event => setCard(event.target.value.replace(/\D/g, '').slice(0, 16))} /></label>
              </div>
              <h2>Документы</h2>
              <div className="form-grid files">
                <label>Паспорт<input type="file" accept="image/png,image/jpeg" multiple onChange={event => replaceUploads('passport_photo', event.currentTarget)} /></label>
                <label>Водительское удостоверение<input type="file" accept="image/png,image/jpeg" multiple onChange={event => replaceUploads('driver_license_photo', event.currentTarget)} /></label>
                <label>Лицензия<input type="file" accept="image/png,image/jpeg" multiple onChange={event => replaceUploads('license_photo', event.currentTarget)} /></label>
              </div>
              <h2>Автомобиль</h2>
              <div className="form-grid">
                <label>ID модели<input value={car.cm_id} onChange={event => setCar({ ...car, cm_id: event.target.value })} required /></label>
                <label>Мест<input type="number" min="1" max="20" value={car.seats} onChange={event => setCar({ ...car, seats: Number(event.target.value) })} required /></label>
                <label>Госномер<input value={car.registration_plate} onChange={event => setCar({ ...car, registration_plate: event.target.value })} required /></label>
                <label>Цвет<input value={car.color} onChange={event => setCar({ ...car, color: event.target.value })} required /></label>
                <label>ID класса<input value={car.cc_id} onChange={event => setCar({ ...car, cc_id: event.target.value })} required /></label>
              </div>
            </>}

            <p className="hint left">Пароль при регистрации не вводится: существующий backend taxi создаёт его сам и возвращает в ответе, если email не указан.</p>
            <button className="button" type="submit" disabled={loading || Boolean(validationError)}>{loading ? 'Выполняется…' : 'Создать аккаунт'}</button>
          </form>
        )}
      </section>
    </main>
  )
}
