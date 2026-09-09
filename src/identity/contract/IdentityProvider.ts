import type {
  Credentials,
  Identity,
  ProfileUpdate,
  RegistrationRequest,
  RegistrationResult,
  Session,
  SessionReference,
} from '../model/identity'

export interface IdentityProvider<
  TRegistration extends RegistrationRequest = RegistrationRequest,
  TProfileUpdate extends ProfileUpdate = ProfileUpdate,
> {
  /** Returned sessions always contain a complete Identity, including ACL state. */
  login(credentials: Credentials): Promise<Session>
  register(request: TRegistration): Promise<RegistrationResult>
  restoreSession(reference: SessionReference): Promise<Session | null>
  logout(session: Session | null): Promise<void>
  updateProfile(
    identity: Identity,
    update: TProfileUpdate,
    session: Session,
  ): Promise<Identity>
  remindPassword(identifier: string): Promise<void>
}
