import type { IdentityProvider } from '../contract/IdentityProvider'
import type {
  Credentials,
  Identity,
  ProfileUpdate,
  RegistrationRequest,
  RegistrationResult,
  Session,
  SessionReference,
} from '../model/identity'

export class IdentityService<
  TRegistration extends RegistrationRequest = RegistrationRequest,
  TProfileUpdate extends ProfileUpdate = ProfileUpdate,
> {
  constructor(private readonly provider: IdentityProvider<TRegistration, TProfileUpdate>) {}

  login(credentials: Credentials): Promise<Session> {
    return this.provider.login(credentials)
  }

  register(request: TRegistration): Promise<RegistrationResult> {
    return this.provider.register(request)
  }

  restoreSession(reference: SessionReference): Promise<Session | null> {
    return this.provider.restoreSession(reference)
  }

  updateProfile(identity: Identity, update: TProfileUpdate, session: Session): Promise<Identity> {
    return this.provider.updateProfile(identity, update, session)
  }

  logout(session: Session | null): Promise<void> {
    return this.provider.logout(session)
  }

  remindPassword(identifier: string): Promise<void> {
    return this.provider.remindPassword(identifier)
  }
}
