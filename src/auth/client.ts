/**
 * Compatibility export. New consumers should instantiate TaxiIdentityProvider
 * from `providers/taxi` and pass it to the provider-neutral IdentityService.
 */
export {
  createAuthClient,
  HttpAuthClient,
  normalizeDriverPhone,
} from '../providers/taxi/httpClient'
export type {
  AuthClientOptions,
  AuthEndpoints,
} from '../providers/taxi/httpClient'
