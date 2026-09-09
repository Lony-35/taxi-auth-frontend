/**
 * Legacy compatibility aliases for the extracted demo/UI. New provider code
 * owns its DTOs in `src/providers/taxi/types.ts` and never imports this facade.
 */
import type { TaxiApi, TaxiAuthSession, TaxiTokens, TaxiUser } from '../providers/taxi/types'

export { UserCheckState, UserRole } from '../providers/taxi/types'
export type {
  DriverCar, DriverCarRequest, LoginRequest, ProfileDocumentChange,
  ProfileUpdateResult, ReferralCodeResult, RegisterRequest, RegisterResult,
  RegistrationUpload, RegistrationType, UpdateProfileRequest,
} from '../providers/taxi/types'

export type AuthService = TaxiApi
export type AuthSession = TaxiAuthSession
export type AuthTokens = TaxiTokens
export type AuthUser = TaxiUser
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error'

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  tokens: AuthTokens | null
  error: string | null
  registration: import('../providers/taxi/types').RegisterResult | null
}

export type AuthListener = () => void
