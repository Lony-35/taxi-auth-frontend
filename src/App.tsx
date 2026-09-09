import { type FormEvent, useState } from 'react'
import { useAuth, UserRole, type RegistrationType } from './auth'

interface AppProps {
  useMock: boolean
}

type Tab = 'login' | 'register'

export default function App({ useMock }: AppProps) {
  const { state, login, register, logout, clearError } = useAuth()
  const [tab, setTab] = useState<Tab>('login')
  const [loginValue, setLoginValue] = useState(useMock ? 'demo@example.com' : '')
  const [password, setPassword] = useState(useMock ? 'demo' : '')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const registrationType: RegistrationType = loginValue.includes('@') ? 'e-mail' : 'phone'

  const loading = state.status === 'loading'

  const switchTab = (next: Tab) => {
    clearError()
    setTab(next)
  }

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await login({ login: loginValue.trim(), password, type: registrationType })
    } catch {
      // Текст ошибки уже находится в AuthStore.
    }
  }

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await register({
        u_name: name.trim(),
        u_email: email.trim() || undefined,
        u_phone: phone.trim() || undefined,
        u_role: UserRole.Client,
      })
    } catch {
      // Текст ошибки уже находится в AuthStore.
    }
  }

  if (state.user) {
    return (
      <main className="shell">
        <section className="card profile-card">
          <div className="success-mark" aria-hidden="true">✓</div>
          <p className="eyebrow">Сессия активна</p>
          <h1>Здравствуйте, {state.user.u_name || 'пользователь'}</h1>
          <dl className="profile-data">
            <div><dt>ID</dt><dd>{state.user.u_id}</dd></div>
            <div><dt>Email</dt><dd>{state.user.u_email || 'не указан'}</dd></div>
            <div><dt>Роль</dt><dd>{state.user.u_role}</dd></div>
          </dl>
          <button className="button secondary" disabled={loading} onClick={() => void logout()}>
            Выйти
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">React + TypeScript</p>
        <h1>Авторизация, которую можно перенести в любой продукт</h1>
        <p>API, состояние и хранение токенов отделены от интерфейса и бизнес-логики такси.</p>
        <ul>
          <li>двухшаговый вход через auth_hash</li>
          <li>восстановление сессии при запуске</li>
          <li>подменяемый API-клиент и storage</li>
        </ul>
      </section>

      <section className="card">
        <div className="mode-row">
          <span className={`status-dot ${useMock ? 'mock' : 'live'}`} />
          {useMock ? 'Автономный demo-режим' : 'Подключён реальный API'}
        </div>

        <div className="tabs" role="tablist" aria-label="Авторизация">
          <button className={tab === 'login' ? 'active' : ''} onClick={() => switchTab('login')}>Вход</button>
          <button className={tab === 'register' ? 'active' : ''} onClick={() => switchTab('register')}>Регистрация</button>
        </div>

        {state.error && <div className="alert" role="alert">{state.error}</div>}

        {tab === 'login' ? (
          <form onSubmit={submitLogin}>
            <label>
              Email или телефон
              <input
                autoComplete="username"
                value={loginValue}
                onChange={event => setLoginValue(event.target.value)}
                required
              />
            </label>
            <label>
              Пароль
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
              />
            </label>
            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Выполняется…' : 'Войти'}
            </button>
            {useMock && <p className="hint">Demo: demo@example.com / demo</p>}
          </form>
        ) : (
          <form onSubmit={submitRegister}>
            <label>
              Имя
              <input value={name} onChange={event => setName(event.target.value)} required />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={event => setEmail(event.target.value)} required />
            </label>
            <label>
              Телефон <span className="optional">необязательно</span>
              <input type="tel" value={phone} onChange={event => setPhone(event.target.value)} />
            </label>
            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Выполняется…' : 'Создать аккаунт'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
