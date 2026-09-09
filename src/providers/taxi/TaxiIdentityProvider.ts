import type { IdentityProvider } from '../../identity'
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
  AuthService,
  DriverCar,
  DriverCarRequest,
  RegistrationUpload,
  UpdateProfileRequest,
} from '../../auth/types'
import { UserRole } from '../../auth/types'
import {
  identityProfileToTaxiValues,
  sessionReferenceToTaxiTokens,
  taxiAuthToSession,
  taxiTokensToSessionReference,
  taxiUserToIdentity,
} from './mapping'

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
  constructor(private readonly taxiApi: AuthService) {}

  async login(credentials: Credentials): Promise<Session> {
    const result = await this.taxiApi.login({
      login: credentials.identifier,
      password: credentials.secret,
      type: credentials.kind === 'phone' ? 'phone' : 'e-mail',
    })
    return taxiAuthToSession(result)
  }

  async register(request: TaxiRegistrationRequest): Promise<RegistrationResult> {
    const taxi = request.taxi
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
      ? { identity, reference: taxiTokensToSessionReference(result.tokens) }
      : null
    return { identity, session }
  }

  async restoreSession(reference: SessionReference): Promise<Session | null> {
    const tokens = sessionReferenceToTaxiTokens(reference)
    const user = await this.taxiApi.getAuthorizedUser(tokens)
    return { identity: taxiUserToIdentity(user), reference }
  }

  async updateProfile(
    identity: Identity,
    update: TaxiProfileUpdate,
    session: Session,
  ): Promise<Identity> {
    const tokens = sessionReferenceToTaxiTokens(session.reference)
    const currentUser = await this.taxiApi.getAuthorizedUser(tokens)
    if (currentUser.u_id !== identity.id) throw new Error('Taxi identity mismatch')
    const result = await this.taxiApi.updateProfile(currentUser, {
      values: identityProfileToTaxiValues(update.profile),
      ...update.taxi,
    }, tokens)
    return taxiUserToIdentity(result.user)
  }

  async logout(session: Session | null): Promise<void> {
    await this.taxiApi.logout(session
      ? sessionReferenceToTaxiTokens(session.reference)
      : null)
  }

  remindPassword(identifier: string): Promise<void> {
    return this.taxiApi.remindPassword(identifier)
  }

  checkReferralCode(code: string) {
    return this.taxiApi.checkReferralCode(code)
  }

  getAuthorizedCars(session: Session): Promise<DriverCar[]> {
    return this.taxiApi.getAuthorizedCars(sessionReferenceToTaxiTokens(session.reference))
  }
}
