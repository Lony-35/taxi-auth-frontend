export { createAuthClient, HttpAuthClient, normalizeDriverPhone } from './client'
export type { AuthClientOptions, AuthEndpoints } from './client'
export { AuthApiError } from './errors'
export { AuthProvider, useAuth } from './context'
export { AuthStore } from './store'
export {
  createDefaultTokenStorage,
  LocalTokenStorage,
  MemoryTokenStorage,
} from './storage'
export type { TokenStorage } from './storage'
export { MockAuthClient } from './mock'
export { UserRole } from './types'
export { jsonDetailsSerializer, taxiDetailsSerializer } from './formData'
export type {
  AuthService,
  AuthSession,
  AuthState,
  AuthStatus,
  AuthTokens,
  AuthUser,
  LoginRequest,
  DriverCarRequest,
  ReferralCodeResult,
  RegisterRequest,
  RegisterResult,
  RegistrationUpload,
  RegistrationType,
} from './types'
