export { createAuthClient, HttpAuthClient, normalizeDriverPhone } from './httpClient'
export type { AuthClientOptions, AuthEndpoints } from './httpClient'
export { TaxiIdentityProvider } from './TaxiIdentityProvider'
export {
  MemoryTaxiSessionVault,
  PersistentTaxiSessionVault,
  createDefaultTaxiSessionVault,
} from './sessionVault'
export type { TaxiCredentialStorage, TaxiSessionVault } from './sessionVault'
export type { TaxiSessionResolution } from './sessionVault'
export { TaxiApiError } from './errors'
export type { TaxiErrorCode } from './errors'
export { UserCheckState, UserRole } from './types'
export type { TaxiApi, TaxiAuthSession, TaxiTokens, TaxiUser } from './types'
export type {
  TaxiProfileUpdate,
  TaxiRegistrationData,
  TaxiRegistrationRequest,
} from './TaxiIdentityProvider'
export {
  identityProfileToTaxiValues,
  taxiAuthToSession,
  taxiProfileToIdentityProfile,
  taxiRoleToRole,
  taxiStatusToIdentityStatus,
  taxiUserToPermissions,
  taxiUserToIdentity,
} from './mapping'
