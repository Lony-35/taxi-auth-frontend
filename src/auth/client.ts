import { AuthApiError } from './errors'
import { toFormData, type DetailsSerializer, jsonDetailsSerializer } from './formData'
import type {
  AuthService,
  AuthSession,
  AuthTokens,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  RegisterResult,
} from './types'
import { normalizeUser } from './userMapping'

interface ApiEnvelope {
  status?: string
  message?: string
  data?: unknown
  auth_hash?: string
  auth_user?: unknown
  token?: string
  u_hash?: string
  u_id?: string | number | null
  email_status?: boolean
  string?: string
}

export interface AuthEndpoints {
  login: string
  token: string
  register: string
  authorizedUser: string
  logout: string
}

export interface AuthClientOptions {
  baseUrl: string
  endpoints?: Partial<AuthEndpoints>
  fetch?: typeof globalThis.fetch
  serializeDetails?: DetailsSerializer
}

const defaultEndpoints: AuthEndpoints = {
  login: '/auth',
  token: '/token',
  register: '/register',
  authorizedUser: '/user/authorized',
  logout: '/logout',
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function nestedData(envelope: ApiEnvelope): Record<string, unknown> {
  return record(envelope.data)
}

function getMessage(envelope: ApiEnvelope): string | null {
  if (typeof envelope.message === 'string') return envelope.message
  if (typeof envelope.data === 'string') return envelope.data
  return null
}

function messageToError(message: string, details?: unknown): AuthApiError {
  const normalized = message.toLowerCase().trim()
  const map = {
    'wrong login': ['Неверный логин', 'wrong_login'],
    'wrong password': ['Неверный пароль', 'wrong_password'],
    'wrong phone': ['Неверный номер телефона', 'wrong_phone'],
    'code sent': ['Код подтверждения отправлен', 'code_sent'],
  } as const
  const known = map[normalized as keyof typeof map]
  return known
    ? new AuthApiError(known[0], known[1], { details })
    : new AuthApiError(message || 'Ошибка API авторизации', 'unknown', { details })
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

export class HttpAuthClient implements AuthService {
  private readonly endpoints: AuthEndpoints
  private readonly fetcher: typeof globalThis.fetch
  private readonly serializeDetails: DetailsSerializer

  constructor(private readonly options: AuthClientOptions) {
    if (!options.baseUrl.trim()) throw new Error('Для AuthClient требуется baseUrl')
    this.endpoints = { ...defaultEndpoints, ...options.endpoints }
    this.fetcher = options.fetch ?? globalThis.fetch
    this.serializeDetails = options.serializeDetails ?? jsonDetailsSerializer
    if (!this.fetcher) throw new Error('В окружении отсутствует fetch')
  }

  async login(data: LoginRequest): Promise<AuthSession> {
    const auth = await this.post(this.endpoints.login, {
      ...data,
      au: 'f',
    })

    const authMessage = getMessage(auth)
    if (authMessage && ['wrong login', 'wrong password', 'wrong phone', 'code sent']
      .includes(authMessage.toLowerCase().trim())) {
      throw messageToError(authMessage, auth)
    }
    if (!auth.auth_hash) {
      throw new AuthApiError('API не вернул auth_hash', 'protocol', { details: auth })
    }

    const tokenEnvelope = await this.post(this.endpoints.token, {
      auth_hash: auth.auth_hash,
    })
    const tokenData = nestedData(tokenEnvelope)
    const token = String(tokenData.token ?? tokenEnvelope.token ?? '')
    const userHash = String(tokenData.u_hash ?? tokenEnvelope.u_hash ?? '')
    if (!token || !userHash) {
      throw new AuthApiError('API не вернул token и u_hash', 'protocol', {
        details: tokenEnvelope,
      })
    }

    const rawUser = auth.auth_user ?? tokenEnvelope.auth_user
    if (!rawUser) {
      throw new AuthApiError('API не вернул пользователя после входа', 'protocol', {
        details: auth,
      })
    }

    return {
      user: normalizeUser(rawUser),
      tokens: { token, u_hash: userHash },
    }
  }

  async register(data: RegisterRequest): Promise<RegisterResult> {
    const envelope = await this.post(this.endpoints.register, {
      ...data,
      u_role: data.u_role ?? 1,
      st: data.u_role === 2 ? 1 : undefined,
    })
    const response = nestedData(envelope)
    const error = envelope.status === 'error'
      ? String(envelope.message ?? envelope.data ?? 'Регистрация отклонена')
      : null
    if (error) throw messageToError(error, envelope)

    const token = String(response.token ?? envelope.token ?? '')
    const userHash = String(response.u_hash ?? envelope.u_hash ?? '')
    const tokens = token && userHash ? { token, u_hash: userHash } : null
    let user: AuthUser | null = null
    if (tokens) {
      try {
        user = await this.getAuthorizedUser(tokens)
      } catch {
        // Регистрация остаётся успешной: профиль можно восстановить при следующем входе.
      }
    }

    const id = response.u_id ?? envelope.u_id
    return {
      userId: id === undefined || id === null ? null : String(id),
      emailStatus: Boolean(response.email_status ?? envelope.email_status),
      generatedPassword: String(response.string ?? envelope.string ?? '') || null,
      tokens,
      user,
    }
  }

  async getAuthorizedUser(tokens: AuthTokens): Promise<AuthUser> {
    const envelope = await this.post(this.endpoints.authorizedUser, {
      token: tokens.token,
      u_hash: tokens.u_hash,
    })
    const data = nestedData(envelope)
    const users = record(data.user)
    const rawUser = Object.values(users)[0] ?? envelope.auth_user
    if (!rawUser) {
      throw new AuthApiError('Сессия недействительна', 'unauthorized', { details: envelope })
    }
    return normalizeUser(rawUser)
  }

  async logout(tokens: AuthTokens | null): Promise<void> {
    await this.post(this.endpoints.logout, tokens ? {
      token: tokens.token,
      u_hash: tokens.u_hash,
    } : {})
  }

  private async post(path: string, values: Record<string, unknown>): Promise<ApiEnvelope> {
    let response: Response
    try {
      response = await this.fetcher(joinUrl(this.options.baseUrl, path), {
        method: 'POST',
        body: toFormData(values, this.serializeDetails),
      })
    } catch (cause) {
      throw new AuthApiError('Не удалось связаться с сервером', 'network', { cause })
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch (cause) {
      throw new AuthApiError('Сервер вернул невалидный JSON', 'protocol', {
        status: response.status,
        cause,
      })
    }

    if (!response.ok) {
      throw new AuthApiError(
        String(record(payload).message ?? `HTTP ${response.status}`),
        response.status === 401 ? 'unauthorized' : 'unknown',
        { status: response.status, details: payload },
      )
    }

    const envelope = record(payload) as ApiEnvelope
    if (envelope.status === 'error') {
      throw messageToError(
        String(envelope.message ?? envelope.data ?? 'Ошибка API'),
        envelope,
      )
    }
    return envelope
  }
}

export function createAuthClient(options: AuthClientOptions): AuthService {
  return new HttpAuthClient(options)
}
