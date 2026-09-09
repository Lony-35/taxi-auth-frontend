import { AuthApiError } from './errors'
import type {
  AuthService,
  AuthSession,
  AuthTokens,
  AuthUser,
  DriverCar,
  LoginRequest,
  ProfileUpdateResult,
  RegisterRequest,
  RegisterResult,
  ReferralCodeResult,
  UpdateProfileRequest,
} from './types'
import { UserRole } from './types'

const demoUser: AuthUser = {
  u_id: 'demo-1',
  u_name: 'Demo User',
  u_email: 'demo@example.com',
  u_role: UserRole.Client,
  u_active: true,
  u_phone_checked: false,
}

const demoTokens: AuthTokens = { token: 'demo-token', u_hash: 'demo-user-hash' }

export class MockAuthClient implements AuthService {
  private user: AuthUser = demoUser
  private car: DriverCar = {
    c_id: 'demo-car', cm_id: 'model-1', seats: 4,
    registration_plate: 'DEMO-01', color: 'green', cc_id: 'economy',
  }

  async login(request: LoginRequest): Promise<AuthSession> {
    await Promise.resolve()
    if (request.login !== 'demo@example.com' || request.password !== 'demo') {
      throw new AuthApiError('Неверный логин или пароль', 'wrong_login')
    }
    return { user: this.user, tokens: demoTokens }
  }

  async register(request: RegisterRequest): Promise<RegisterResult> {
    await Promise.resolve()
    this.user = {
      u_id: `demo-${Date.now()}`,
      u_name: request.u_name,
      u_email: request.u_email ?? '',
      u_phone: request.u_phone,
      u_role: request.u_role ?? UserRole.Client,
      u_active: true,
      u_phone_checked: false,
    }
    return {
      userId: this.user.u_id,
      emailStatus: Boolean(this.user.u_email),
      generatedPassword: null,
      tokens: demoTokens,
      user: this.user,
      uploadedFileIds: {},
      carId: request.u_car ? 'demo-car' : null,
    }
  }

  async remindPassword(email: string): Promise<void> {
    await Promise.resolve()
    if (!email.includes('@')) throw new AuthApiError('Укажите корректный email', 'unknown')
  }

  async checkReferralCode(code: string): Promise<ReferralCodeResult> {
    await Promise.resolve()
    return { exists: code.trim().toUpperCase() === 'TAXI2026' }
  }

  async updateProfile(
    currentUser: AuthUser,
    request: UpdateProfileRequest,
  ): Promise<ProfileUpdateResult> {
    await Promise.resolve()
    this.user = { ...currentUser, ...request.values }
    if (request.car) this.car = request.car
    return { user: this.user, car: request.car ?? null, uploadedFileIds: {} }
  }

  async getAuthorizedCars(): Promise<DriverCar[]> {
    await Promise.resolve()
    return this.user.u_role === UserRole.Driver ? [this.car] : []
  }

  async getAuthorizedUser(tokens: AuthTokens): Promise<AuthUser> {
    await Promise.resolve()
    if (tokens.token !== demoTokens.token || tokens.u_hash !== demoTokens.u_hash) {
      throw new AuthApiError('Сессия недействительна', 'unauthorized')
    }
    return this.user
  }

  async logout(): Promise<void> {
    await Promise.resolve()
  }
}
