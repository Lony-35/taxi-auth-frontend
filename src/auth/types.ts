export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error'

export type RegistrationType = 'e-mail' | 'phone'

export enum UserRole {
  Client = 1,
  Driver = 2,
  Administrator = 3,
  Agent = 4,
}

export interface AuthTokens {
  token: string
  u_hash: string
}

export interface AuthUser {
  u_id: string
  u_name: string
  u_email: string
  u_phone?: string
  u_role: UserRole
  u_family?: string
  u_middle?: string
  u_active?: boolean
  u_phone_checked?: boolean
  u_details?: Record<string, unknown>
  [key: string]: unknown
}

export interface LoginRequest {
  login: string
  password?: string
  type: RegistrationType
}

export interface RegisterRequest {
  u_name: string
  u_email?: string
  u_phone?: string
  u_role?: UserRole
  ref_code?: string
  u_details?: Record<string, unknown>
  [key: string]: unknown
}

export interface RegisterResult {
  userId: string | null
  emailStatus: boolean
  generatedPassword: string | null
  tokens: AuthTokens | null
  user: AuthUser | null
}

export interface AuthSession {
  user: AuthUser
  tokens: AuthTokens
}

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  tokens: AuthTokens | null
  error: string | null
  registration: RegisterResult | null
}

export interface AuthService {
  login(data: LoginRequest): Promise<AuthSession>
  register(data: RegisterRequest): Promise<RegisterResult>
  getAuthorizedUser(tokens: AuthTokens): Promise<AuthUser>
  logout(tokens: AuthTokens | null): Promise<void>
}

export type AuthListener = () => void
