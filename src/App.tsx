import { type FormEvent, useMemo, useState } from 'react'
import {
  useAuth,
  UserRole,
  type DriverCarRequest,
  type RegisterRequest,
  type RegistrationType,
  type RegistrationUpload,
} from './auth'
import JSONForm from './JSONForm'
import { fallbackRegisterFields, readConfiguredFields, taxiFormAdapter, withPasswordFields } from './forms/config'
import ProfileEditor from './ProfileEditor'

interface AppProps { useMock: boolean }
type Tab = 'login' | 'register'

const emailPattern = /^(([^<>()\[\].,;:\s@"]+(\.[^<>()\[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i
const phonePattern = /^[+]?\d{1,3}[(]?\d{3}[)]?[-\s.]?\d{3}[-\s.]?\d{3,6}$/i

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function uploadsFrom(values: Record<string, unknown>): RegistrationUpload[] {
  const names: RegistrationUpload['name'][] = ['passport_photo', 'driver_license_photo', 'license_photo']
  return names.flatMap(name => {
    const entries = Array.isArray(values[name]) ? values[name] as Array<[unknown, Blob]> : []
    return entries.filter(item => item?.[1] instanceof Blob).map(item => ({ name, file: item[1] }))
  })
}

export default function App({ useMock }: AppProps) {
  const { state, login, register, remindPassword, checkReferralCode, logout, clearError } = useAuth()
  const [tab, setTab] = useState<Tab>('login')
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [loginValue, setLoginValue] = useState(useMock ? 'demo@example.com' : '')
  const [password, setPassword] = useState(useMock ? 'demo' : '')

  const registerFields = useMemo(() => {
    try {
      return withPasswordFields(readConfiguredFields('form_register', fallbackRegisterFields))
    } catch {
      return withPasswordFields(fallbackRegisterFields)
    }
  }, [])

  const loading = state.status === 'loading'
  const loginType: RegistrationType = loginValue.includes('@') ? 'e-mail' : 'phone'
  const loginValidation = loginType === 'e-mail'
    ? loginValue && !emailPattern.test(loginValue) ? 'Email указан неверно' : ''
    : loginValue && !phonePattern.test(loginValue) ? 'Телефон указан неверно' : ''

  const switchTab = (next: Tab) => {
    clearError()
    setNotice('')
    setFormError('')
    setTab(next)
  }

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault()
    if (loginValidation) return
    setNotice('')
    try { await login({ login: loginValue.trim(), password, type: loginType }) } catch { /* AuthStore owns the error. */ }
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

  const submitRegister = async (submitted: Record<string, unknown>) => {
    setNotice('')
    setFormError('')
    const data = record(submitted.data)
    const passwordValue = String(submitted.password ?? data.password ?? '')
    const passwordConfirm = String(submitted.password_confirm ?? '')
    if (passwordValue !== passwordConfirm) {
      setFormError('Пароли не совпадают.')
      return
    }

    const refCode = String(submitted.ref_code ?? '').trim()
    const promoCode = String(submitted.promo_code ?? '').trim()
    if (refCode) {
      const referral = await checkReferralCode(refCode)
      if (!referral.exists) {
        setFormError('Реферальный код не найден.')
        return
      }
    }

    const role = Number(submitted.u_role ?? UserRole.Client) as UserRole
    const request: RegisterRequest = {
      ...submitted,
      u_name: String(submitted.u_name ?? '').trim(),
      u_email: String(submitted.u_email ?? '').trim() || undefined,
      u_phone: String(submitted.u_phone ?? '').trim() || undefined,
      u_role: role,
      u_city: String(submitted.u_city ?? '').trim() || undefined,
      ref_code: refCode || undefined,
      promo_code: promoCode || undefined,
      u_details: record(submitted.u_details),
      uploads: role === UserRole.Driver ? uploadsFrom(submitted) : undefined,
      u_car: role === UserRole.Driver ? submitted.u_car as DriverCarRequest : undefined,
      data: { ...data, password: passwordValue },
      st: 1,
    }
    for (const key of ['password', 'password_confirm', 'registration_type', 'passport_photo', 'driver_license_photo', 'license_photo']) delete request[key]

    try {
      const result = await register(request)
      setNotice(result.generatedPassword
        ? `Регистрация завершена. Пароль, созданный сервером: ${result.generatedPassword}`
        : 'Регистрация завершена.')
    } catch { /* AuthStore owns the error. */ }
  }

  if (state.user) {
    if (editingProfile) {
      return <main className="shell single"><section className="card wide-card profile-edit-card"><ProfileEditor user={state.user} onClose={() => setEditingProfile(false)} /></section></main>
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
        <h1>Отдельный модуль авторизации Taxi</h1>
        <p>Регистрация и профиль строятся из конфигурации JSON Form, а существующий Auth API отвечает за бизнес-логику и серверные операции.</p>
        <ul>
          <li>динамические поля, условия и варианты выбора</li>
          <li>валидация и вложенные значения</li>
          <li>совместимость с site_constants Taxi</li>
        </ul>
      </section>

      <section className="card wide-card">
        <div className="mode-row"><span className={`status-dot ${useMock ? 'mock' : 'live'}`} />{useMock ? 'Автономный demo-режим' : 'Подключён реальный API'}</div>
        <div className="tabs" role="tablist" aria-label="Авторизация">
          <button className={tab === 'login' ? 'active' : ''} onClick={() => switchTab('login')}>Вход</button>
          <button className={tab === 'register' ? 'active' : ''} onClick={() => switchTab('register')}>Регистрация</button>
        </div>
        {(state.error || loginValidation || formError || notice) && <div className={state.error || loginValidation || formError ? 'alert' : 'notice'} role="status">{state.error || loginValidation || formError || notice}</div>}

        {tab === 'login' ? (
          <form onSubmit={submitLogin}>
            <label>Email или телефон<input autoComplete="username" value={loginValue} onChange={event => setLoginValue(event.target.value)} required /></label>
            <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
            <button className="link-button" type="button" onClick={() => void restorePassword()}>Восстановить пароль</button>
            <button className="button" type="submit" disabled={loading || Boolean(loginValidation)}>{loading ? 'Выполняется…' : 'Войти'}</button>
            {useMock && <p className="hint">Demo: demo@example.com / demo</p>}
          </form>
        ) : (
          <JSONForm
            fields={registerFields}
            adapter={taxiFormAdapter()}
            onSubmit={values => void submitRegister(values)}
            state={{ pending: loading, failed: Boolean(state.error), errorMessage: state.error ?? undefined }}
          />
        )}
      </section>
    </main>
  )
}
