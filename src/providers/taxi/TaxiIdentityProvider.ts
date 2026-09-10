import {
  IdentitySessionError,
  IdentityOperationError,
  type IdentityCapability,
  type IdentityProvider,
} from '../../identity'
import type {
  Credentials,
  Identity,
  ProfileUpdate,
  RegistrationRequest,
  RegistrationResult,
  Session,
  SessionReference,
} from '../../identity'
import type {
  DriverCar,
  DriverCarRequest,
  RegistrationUpload,
  TaxiApi,
  TaxiTokens,
  UpdateProfileRequest,
} from './types'
import { UserRole } from './types'
import {
  identityProfileToTaxiValues,
  taxiAuthToSession,
  taxiUserToIdentity,
} from './mapping'
import { createDefaultTaxiSessionVault, type TaxiSessionVault } from './sessionVault'
import { TaxiApiError } from './errors'

export interface TaxiRegistrationData {
  role?: UserRole
  city?: string
  referralCode?: string
  details?: Record<string, unknown>
  uploads?: RegistrationUpload[]
  car?: DriverCarRequest
  country?: string
  defaultLocationClassId?: string
}

export interface TaxiRegistrationRequest extends RegistrationRequest {
  taxi?: TaxiRegistrationData
}

export interface TaxiProfileUpdate extends ProfileUpdate {
  taxi?: Omit<UpdateProfileRequest, 'values'>
}

/**
 * Provider boundary for the existing Taxi backend. All Taxi DTOs, endpoint
 * behavior and two-step authentication remain behind this class.
 */
export class TaxiIdentityProvider
implements IdentityProvider<TaxiRegistrationRequest, TaxiProfileUpdate> {
  constructor(
    private readonly taxiApi: TaxiApi,
    private readonly sessions: TaxiSessionVault = createDefaultTaxiSessionVault(),
  ) {}

  capabilities(): readonly IdentityCapability[] {
    return TAXI_IDENTITY_CAPABILITIES
  }

  async login(credentials: Credentials): Promise<Session> {
    try {
      const result = await this.taxiApi.login({
        login: credentials.identifier,
        password: credentials.secret,
        type: credentials.kind === 'phone' ? 'phone' : 'e-mail',
      })
      return taxiAuthToSession(result, this.sessions.create(result.tokens))
    } catch (error) {
      throw taxiError(error, 'AUTHENTICATION')
    }
  }

  async register(request: TaxiRegistrationRequest): Promise<RegistrationResult> {
    const taxi = request.taxi
    try {
      const result = await this.taxiApi.register({
        u_name: request.profile.name ?? '',
        u_email: request.profile.email,
        u_phone: request.profile.phone,
        u_role: taxi?.role ?? UserRole.Client,
        u_city: taxi?.city ?? request.profile.city,
        ref_code: taxi?.referralCode,
        u_details: taxi?.details,
        uploads: taxi?.uploads,
        u_car: taxi?.car,
        country: taxi?.country,
        defaultLocationClassId: taxi?.defaultLocationClassId,
      })
      const identity = result.user ? taxiUserToIdentity(result.user) : null
      const session: Session | null = identity && result.tokens
        ? { identity, reference: this.sessions.create(result.tokens) }
        : null
      return { identity, session }
    } catch (error) {
      throw taxiError(error, 'REGISTRATION')
    }
  }

  async restoreSession(reference: SessionReference): Promise<Session | null> {
    const resolved = this.sessions.resolve(reference)
    if (resolved.status === 'missing') throw new IdentitySessionError('INVALID_REFERENCE')
    if (resolved.status === 'expired') throw new IdentitySessionError('EXPIRED_SESSION')
    try {
      const user = await this.taxiApi.getAuthorizedUser(resolved.tokens)
      return { identity: taxiUserToIdentity(user), reference }
    } catch (error) {
      this.sessions.delete(reference)
      if (error instanceof TaxiApiError && error.code === 'unauthorized') {
        throw new IdentitySessionError('INVALID_PROVIDER_CREDENTIALS')
      }
      throw new IdentitySessionError('RESTORE_FAILED')
    }
  }

  async updateProfile(
    identity: Identity,
    update: TaxiProfileUpdate,
    session: Session,
  ): Promise<Identity> {
    const tokens = this.requireTokens(session.reference)
    try {
      const currentUser = await this.taxiApi.getAuthorizedUser(tokens)
      if (currentUser.u_id !== identity.id) {
        throw new IdentityOperationError('AUTHORIZATION_FAILED', 'PROFILE_UPDATE')
      }
      const result = await this.taxiApi.updateProfile(currentUser, {
        values: identityProfileToTaxiValues(update.profile),
        ...update.taxi,
      }, tokens)
      return taxiUserToIdentity(result.user)
    } catch (error) {
      throw taxiError(error, 'PROFILE_UPDATE')
    }
  }

  async logout(session: Session | null): Promise<void> {
    const reference = session?.reference
    const tokens = reference ? this.sessions.read(reference) : null
    try {
      await this.taxiApi.logout(tokens)
    } catch {
      throw new IdentitySessionError('LOGOUT_FAILED')
    } finally {
      if (reference) this.sessions.delete(reference)
    }
  }

  async remindPassword(identifier: string): Promise<void> {
    try {
      await this.taxiApi.remindPassword(identifier)
    } catch (error) {
      throw taxiError(error, 'PASSWORD_RECOVERY')
    }
  }

  checkReferralCode(code: string) {
    return this.taxiApi.checkReferralCode(code)
  }

  getAuthorizedCars(session: Session): Promise<DriverCar[]> {
    return this.taxiApi.getAuthorizedCars(this.requireTokens(session.reference))
  }

  private requireTokens(reference: SessionReference): TaxiTokens {
    const resolved = this.sessions.resolve(reference)
    if (resolved.status === 'missing') throw new IdentitySessionError('INVALID_REFERENCE')
    if (resolved.status === 'expired') throw new IdentitySessionError('EXPIRED_SESSION')
    return resolved.tokens
  }
}

const TAXI_IDENTITY_CAPABILITIES: readonly IdentityCapability[] = Object.freeze([
  'AUTHENTICATION',
  'REGISTRATION',
  'SESSION_RESTORE',
  'PROFILE_READ',
  'PROFILE_UPDATE',
  'PASSWORD_RECOVERY',
  'LOGOUT',
  'ACL',
])

function taxiError(error: unknown, capability: IdentityCapability): IdentityOperationError {
  if (error instanceof IdentityOperationError) return error
  if (error instanceof TaxiApiError) {
    if (error.code === 'wrong_login' || error.code === 'wrong_password') {
      return new IdentityOperationError('AUTHENTICATION_FAILED', capability)
    }
    if (error.code === 'wrong_phone') {
      return new IdentityOperationError('VALIDATION_FAILED', capability)
    }
    if (error.code === 'unauthorized') {
      return new IdentityOperationError('AUTHORIZATION_FAILED', capability)
    }
  }
  return new IdentityOperationError('PROVIDER_OPERATION_FAILED', capability)
}
