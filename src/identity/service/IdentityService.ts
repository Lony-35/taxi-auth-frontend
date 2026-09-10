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
import type { IdentityCapability } from '../model/capability'
import { IdentityOperationError, type IdentityOperationErrorCode } from '../model/operationError'
import { IdentitySessionError } from '../model/sessionError'

export class IdentityService<
  TRegistration extends RegistrationRequest = RegistrationRequest,
  TProfileUpdate extends ProfileUpdate = ProfileUpdate,
> {
  private readonly supportedCapabilities: ReadonlySet<IdentityCapability>

  constructor(private readonly provider: IdentityProvider<TRegistration, TProfileUpdate>) {
    this.supportedCapabilities = new Set(provider.capabilities())
  }

  capabilities(): readonly IdentityCapability[] {
    return Object.freeze([...this.supportedCapabilities])
  }

  hasCapability(capability: IdentityCapability): boolean {
    return this.supportedCapabilities.has(capability)
  }

  async login(credentials: Credentials): Promise<Session> {
    this.requireCapability('AUTHENTICATION', this.provider.login)
    return this.invoke('AUTHENTICATION', 'PROVIDER_OPERATION_FAILED',
      () => this.provider.login!(credentials))
  }

  async register(request: TRegistration): Promise<RegistrationResult> {
    this.requireCapability('REGISTRATION', this.provider.register)
    return this.invoke('REGISTRATION', 'PROVIDER_OPERATION_FAILED', () => this.provider.register!(request))
  }

  async restoreSession(reference: SessionReference): Promise<Session | null> {
    this.requireCapability('SESSION_RESTORE', this.provider.restoreSession)
    return this.invoke('SESSION_RESTORE', 'PROVIDER_OPERATION_FAILED',
      () => this.provider.restoreSession!(reference))
  }

  async updateProfile(identity: Identity, update: TProfileUpdate, session: Session): Promise<Identity> {
    this.requireCapability('PROFILE_UPDATE', this.provider.updateProfile)
    return this.invoke('PROFILE_UPDATE', 'PROVIDER_OPERATION_FAILED',
      () => this.provider.updateProfile!(identity, update, session))
  }

  async logout(session: Session | null): Promise<void> {
    this.requireCapability('LOGOUT', this.provider.logout)
    return this.invoke('LOGOUT', 'PROVIDER_OPERATION_FAILED', () => this.provider.logout!(session))
  }

  async remindPassword(identifier: string): Promise<void> {
    this.requireCapability('PASSWORD_RECOVERY', this.provider.remindPassword)
    return this.invoke('PASSWORD_RECOVERY', 'PROVIDER_OPERATION_FAILED',
      () => this.provider.remindPassword!(identifier))
  }

  hasRole(identity: Identity | null, role: Role): boolean {
    return identity?.roles.includes(role) ?? false
  }

  hasPermission(identity: Identity | null, permission: Permission): boolean {
    return identity?.permissions.includes(permission) ?? false
  }

  private requireCapability(capability: IdentityCapability, operation: unknown): void {
    if (!this.hasCapability(capability)) {
      throw new IdentityOperationError('UNSUPPORTED_CAPABILITY', capability)
    }
    if (typeof operation !== 'function') {
      throw new IdentityOperationError('PROVIDER_OPERATION_FAILED', capability)
    }
  }

  private async invoke<T>(
    capability: IdentityCapability,
    fallback: IdentityOperationErrorCode,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof IdentityOperationError || error instanceof IdentitySessionError) throw error
      throw new IdentityOperationError(fallback, capability)
    }
  }
}
