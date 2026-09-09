export { createAuthClient, HttpAuthClient, normalizeDriverPhone } from './httpClient'
export type { AuthClientOptions, AuthEndpoints } from './httpClient'
export { TaxiIdentityProvider } from './TaxiIdentityProvider'
export type {
  TaxiProfileUpdate,
  TaxiRegistrationData,
  TaxiRegistrationRequest,
} from './TaxiIdentityProvider'
export {
  identityProfileToTaxiValues,
  sessionReferenceToTaxiTokens,
  taxiAuthToSession,
  taxiProfileToIdentityProfile,
  taxiStatusToIdentityStatus,
  taxiTokensToSessionReference,
  taxiUserToIdentity,
} from './mapping'
