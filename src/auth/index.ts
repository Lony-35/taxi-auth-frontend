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
export {
  IdentityService,
  IdentityStore,
  MemorySessionStorage,
  FakeIdentityProvider,
} from '../identity'
export type {
  Credentials,
  Identity,
  IdentityId,
  IdentityProfile,
  IdentityStatus,
  ProfileUpdate,
  RegistrationRequest,
  RegistrationResult,
  Session,
  SessionReference,
} from '../identity'
export { TaxiIdentityProvider } from '../providers/taxi'
export { UserCheckState, UserRole } from './types'
export { jsonDetailsSerializer, taxiDetailsSerializer } from '../providers/taxi/formData'
export {
  allowedProfileFields,
  carProfileFields,
  clientProfileFields,
  driverActiveProfileFields,
  driverRequiredProfileFields,
} from '../providers/taxi/profile'
export type {
  AuthService,
  AuthSession,
  AuthState,
  AuthStatus,
  AuthTokens,
  AuthUser,
  DriverCar,
  DriverCarRequest,
  LoginRequest,
  ProfileDocumentChange,
  ProfileUpdateResult,
  ReferralCodeResult,
  RegisterRequest,
  RegisterResult,
  RegistrationUpload,
  RegistrationType,
  UpdateProfileRequest,
} from './types'
