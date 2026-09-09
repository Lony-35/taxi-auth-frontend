import type { IdentityProvider } from '../contract/IdentityProvider'
import type {
  Credentials,
  Identity,
  ProfileUpdate,
  Permission,
  RegistrationRequest,
  RegistrationResult,
  Session,
  SessionReference,
  Role,
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

  hasRole(identity: Identity | null, role: Role): boolean {
    return identity?.roles.includes(role) ?? false
  }

  hasPermission(identity: Identity | null, permission: Permission): boolean {
    return identity?.permissions.includes(permission) ?? false
  }
}
