import { AuthApiError } from './errors'
import { toFormData, type DetailsSerializer, taxiDetailsSerializer } from './formData'
import type {
  AuthService,
  AuthSession,
  AuthTokens,
  AuthUser,
  DriverCar,
  DriverCarRequest,
  LoginRequest,
  ProfileUpdateResult,
  ReferralCodeResult,
  RegisterRequest,
  RegisterResult,
  RegistrationUpload,
  UpdateProfileRequest,
} from './types'
import { normalizeUser } from './userMapping'
import { allowedProfileFields, carProfileFields, filterFields, toLegacyDetails } from './profile'

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
  code?: string
  created_car?: { c_id?: string | number }
}

export interface AuthEndpoints {
  login: string
  token: string
  register: string
  remindPassword: string
  referralCheck: (code: string) => string
  uploadFile: string
  editUser: string
  createCar: string
  editCar: (id: string) => string
  authorizedCars: string
  authorizedUser: string
  logout: string
}

export interface AuthClientOptions {
  baseUrl: string
  endpoints?: Partial<AuthEndpoints>
  fetch?: typeof globalThis.fetch
  serializeDetails?: DetailsSerializer
  fileToBase64?: (file: Blob) => Promise<string>
  driverPhonePrefix?: string
  defaultCountry?: string
  defaultLocationClassId?: string
}

const defaultEndpoints: AuthEndpoints = {
  login: '/auth',
  token: '/token',
  register: '/register',
  remindPassword: '/remind',
  referralCheck: code => `/referral/code/${encodeURIComponent(code)}/check`,
  uploadFile: '/dropbox/file',
  editUser: '/user',
  createCar: '/car',
  editCar: id => `/car/${encodeURIComponent(id)}`,
  authorizedCars: '/user/authorized/car',
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
    'busy registration plate': ['Этот госномер уже используется', 'unknown'],
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
  private readonly fileToBase64: (file: Blob) => Promise<string>

  constructor(private readonly options: AuthClientOptions) {
    if (!options.baseUrl.trim()) throw new Error('Для AuthClient требуется baseUrl')
    this.endpoints = { ...defaultEndpoints, ...options.endpoints }
    this.fetcher = options.fetch ?? globalThis.fetch
    this.serializeDetails = options.serializeDetails ?? taxiDetailsSerializer
    this.fileToBase64 = options.fileToBase64 ?? blobToDataUrl
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
    const {
      uploads = [],
      u_car: car,
      country,
      defaultLocationClassId,
      ...registration
    } = data
    const normalizedPhone = registration.u_role === 2 && registration.u_phone
      ? normalizeDriverPhone(registration.u_phone, this.options.driverPhonePrefix)
      : registration.u_phone
    const envelope = await this.post(this.endpoints.register, {
      ...registration,
      u_phone: normalizedPhone,
      u_role: registration.u_role ?? 1,
      st: registration.u_role === 2 ? 1 : undefined,
    })
    const response = nestedData(envelope)
    const error = envelope.status === 'error'
      ? String(envelope.message ?? envelope.data ?? 'Регистрация отклонена')
      : null
    if (error) throw messageToError(error, envelope)

    const token = String(response.token ?? envelope.token ?? '')
    const userHash = String(response.u_hash ?? envelope.u_hash ?? '')
    const tokens = token && userHash ? { token, u_hash: userHash } : null
    const id = response.u_id ?? envelope.u_id
    const userId = id === undefined || id === null ? null : String(id)
    const uploadedFileIds: Partial<Record<RegistrationUpload['name'], string[]>> = {}
    let carId: string | null = null

    if (registration.u_role === 2 && tokens && userId) {
      for (const upload of uploads) {
        const fileId = await this.uploadRegistrationFile(upload.file, userId, tokens)
        uploadedFileIds[upload.name] = [...(uploadedFileIds[upload.name] ?? []), fileId]
      }

      if (Object.keys(uploadedFileIds).length || registration.u_details) {
        await this.updateRegisteredDriver(
          userId,
          tokens,
          registration.u_details ?? {},
          uploadedFileIds,
        )
      }

      if (car) {
        carId = await this.createDriverCar(car, tokens)
        const licenseCountry = country ?? this.options.defaultCountry
        const locationClassId = defaultLocationClassId ?? this.options.defaultLocationClassId
        if (carId && licenseCountry && locationClassId) {
          await this.setDefaultCarLicense(carId, licenseCountry, locationClassId, tokens)
        }
      }
    }

    let user: AuthUser | null = null
    if (tokens) {
      try {
        user = await this.getAuthorizedUser(tokens)
      } catch {
        // Регистрация остаётся успешной: профиль можно восстановить при следующем входе.
      }
    }

    return {
      userId,
      emailStatus: Boolean(response.email_status ?? envelope.email_status),
      generatedPassword: String(response.string ?? envelope.string ?? '') || null,
      tokens,
      user,
      uploadedFileIds,
      carId,
    }
  }

  async remindPassword(email: string): Promise<void> {
    await this.post(this.endpoints.remindPassword, { u_email: email })
  }

  async checkReferralCode(code: string): Promise<ReferralCodeResult> {
    const envelope = await this.request(this.endpoints.referralCheck(code), { method: 'GET' })
    const data = nestedData(envelope)
    return { exists: !Boolean(data.ref_code_free) }
  }

  async updateProfile(
    currentUser: AuthUser,
    data: UpdateProfileRequest,
    tokens: AuthTokens,
  ): Promise<ProfileUpdateResult> {
    if (data.values.ref_code && data.values.ref_code !== currentUser.ref_code) {
      const referral = await this.checkReferralCode(String(data.values.ref_code))
      if (!referral.exists) {
        throw new AuthApiError('Промокод не найден', 'unknown')
      }
    }

    const values = filterFields(data.values, allowedProfileFields(currentUser))
    if (currentUser.u_role === 2 && typeof values.u_phone === 'string') {
      values.u_phone = normalizeDriverPhone(values.u_phone, this.options.driverPhonePrefix)
    }
    if (data.avatar) values.u_photo = await this.fileToBase64(data.avatar)

    let updatedCar: DriverCar | null = null
    if (currentUser.u_role === 2 && data.car) {
      const carValues = filterFields(data.car, carProfileFields)
      const envelope = await this.post(this.endpoints.editCar(data.car.c_id), {
        ...tokens,
        data: JSON.stringify(carValues),
      })
      updatedCar = data.car
    }

    const uploadedFileIds: ProfileUpdateResult['uploadedFileIds'] = {}
    if (currentUser.u_role === 2 && data.documents) {
      const details = record(values.u_details ?? currentUser.u_details)
      for (const name of ['passport_photo', 'driver_license_photo'] as const) {
        const change = data.documents[name]
        if (!change) continue
        const ids = (change.existingIds ?? []).map(String)
        for (const file of change.files ?? []) {
          ids.push(await this.uploadRegistrationFile(file, currentUser.u_id, tokens))
        }
        details[name] = ids
        uploadedFileIds[name] = ids
      }
      values.u_details = details
    }

    await this.editUser(values, tokens)
    return {
      user: await this.getAuthorizedUser(tokens),
      car: updatedCar,
      uploadedFileIds,
    }
  }

  async getAuthorizedCars(tokens: AuthTokens): Promise<DriverCar[]> {
    const envelope = await this.post(this.endpoints.authorizedCars, { ...tokens })
    const cars = record(nestedData(envelope).car)
    return Object.values(cars).map(raw => {
      const value = record(raw)
      return {
        ...value,
        c_id: String(value.c_id ?? ''),
        cm_id: String(value.cm_id ?? ''),
        seats: Number(value.seats ?? 0),
        registration_plate: String(value.registration_plate ?? ''),
        color: String(value.color ?? ''),
        cc_id: String(value.cc_id ?? ''),
      } as DriverCar
    })
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

  private async uploadRegistrationFile(
    file: Blob,
    userId: string,
    tokens: AuthTokens,
  ): Promise<string> {
    const envelope = await this.post(this.endpoints.uploadFile, {
      ...tokens,
      file: JSON.stringify({ base64: await this.fileToBase64(file), u_id: userId }),
      private: 0,
    })
    const fileId = nestedData(envelope).dl_id
    if (fileId === undefined || fileId === null) {
      throw new AuthApiError('API не вернул идентификатор загруженного файла', 'protocol', {
        details: envelope,
      })
    }
    return String(fileId)
  }

  private async updateRegisteredDriver(
    userId: string,
    tokens: AuthTokens,
    details: Record<string, unknown>,
    uploadedFileIds: Partial<Record<RegistrationUpload['name'], string[]>>,
  ): Promise<void> {
    const mergedDetails: Record<string, unknown> = { ...details }
    for (const [key, ids] of Object.entries(uploadedFileIds)) {
      mergedDetails[key] = JSON.stringify(ids)
    }
    const legacyDetails = toLegacyDetails(mergedDetails)
    await this.post(this.endpoints.editUser, {
      ...tokens,
      u_id: userId,
      data: JSON.stringify({ u_details: legacyDetails }),
    })
  }

  private async editUser(values: Record<string, unknown>, tokens: AuthTokens): Promise<void> {
    const { u_city, u_details, ...userData } = values
    await this.post(this.endpoints.editUser, {
      ...tokens,
      data: JSON.stringify({
        u_city: u_city || undefined,
        ...userData,
        ...(u_details && typeof u_details === 'object'
          ? { u_details: toLegacyDetails(record(u_details)) }
          : {}),
      }),
    })
  }

  private async createDriverCar(car: DriverCarRequest, tokens: AuthTokens): Promise<string | null> {
    const envelope = await this.post(this.endpoints.createCar, {
      ...tokens,
      data: JSON.stringify(car),
    })
    const data = nestedData(envelope)
    const created = record(data.created_car ?? envelope.created_car)
    const id = created.c_id
    return id === undefined || id === null ? null : String(id)
  }

  private async setDefaultCarLicense(
    carId: string,
    country: string,
    locationClassId: string,
    tokens: AuthTokens,
  ): Promise<void> {
    await this.post(this.endpoints.editCar(carId), {
      ...tokens,
      data: JSON.stringify({
        licenses: [{ en: 'license', b_l_c: [{ location: locationClassId, value: country }] }],
      }),
    })
  }

  private async post(path: string, values: Record<string, unknown>): Promise<ApiEnvelope> {
    return this.request(path, {
      method: 'POST',
      body: toFormData(values, this.serializeDetails),
    })
  }

  private async request(path: string, init: RequestInit): Promise<ApiEnvelope> {
    let response: Response
    try {
      response = await this.fetcher(joinUrl(this.options.baseUrl, path), {
        ...init,
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

function blobToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}

export function createAuthClient(options: AuthClientOptions): AuthService {
  return new HttpAuthClient(options)
}

export function normalizeDriverPhone(phone: string, configuredPrefix?: string): string {
  const prefix = configuredPrefix?.replace(/\D/g, '')
  const digits = phone.replace(/\D/g, '')
  if (!prefix || !digits.startsWith(prefix)) return phone
  return `+11${digits.slice(prefix.length)}`
}
