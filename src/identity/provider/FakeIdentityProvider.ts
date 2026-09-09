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

const fakeReference = 'fake-session' as SessionReference

export class FakeIdentityProvider implements IdentityProvider {
  private identity: Identity = {
    id: 'fake-identity',
    status: 'ACTIVE',
    profile: { name: 'Demo User', email: 'demo@example.com' },
    roles: ['driver'],
    permissions: ['orders.read', 'orders.accept', 'profile.read', 'profile.update'],
  }

  async login(credentials: Credentials): Promise<Session> {
    if (credentials.identifier !== 'demo@example.com' || credentials.secret !== 'demo') {
      throw new Error('Invalid credentials')
    }
    return { identity: this.identity, reference: fakeReference }
  }

  async register(request: RegistrationRequest): Promise<RegistrationResult> {
    this.identity = {
      id: 'fake-registered', status: 'ACTIVE', profile: { ...request.profile },
      roles: ['client'], permissions: ['profile.read', 'profile.update'],
    }
    const session = { identity: this.identity, reference: fakeReference }
    return { identity: this.identity, session }
  }

  async restoreSession(reference: SessionReference): Promise<Session | null> {
    return reference === fakeReference ? { identity: this.identity, reference } : null
  }

  async updateProfile(
    identity: Identity,
    update: ProfileUpdate,
    session: Session,
  ): Promise<Identity> {
    this.identity = { ...identity, profile: { ...identity.profile, ...update.profile } }
    void session
    return this.identity
  }

  async logout(): Promise<void> {}

  async remindPassword(): Promise<void> {}
}
