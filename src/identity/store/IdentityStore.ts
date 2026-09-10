import type { IdentityService } from '../service/IdentityService'
import { MemorySessionStorage, type SessionStorage } from './SessionStorage'
import type {
  Credentials,
  Identity,
  ProfileUpdate,
  Permission,
  RegistrationRequest,
  RegistrationResult,
  Session,
  Role,
} from '../model/identity'
import {
  IdentitySessionError,
  toIdentitySessionError,
  type SessionErrorCode,
} from '../model/sessionError'
import type { IdentityCapability } from '../model/capability'
import {
  IdentityOperationError,
  type IdentityOperationErrorCode,
} from '../model/operationError'

export type IdentityStoreStatus = 'idle' | 'loading' | 'authenticated' | 'error'

export interface IdentityState {
  status: IdentityStoreStatus
  identity: Identity | null
  session: Session | null
  error: string | null
  sessionError: SessionErrorCode | null
  operationError: IdentityOperationErrorCode | null
}

type Listener = () => void

const initialState: IdentityState = {
  status: 'idle', identity: null, session: null, error: null,
  sessionError: 'NO_SESSION', operationError: null,
}

export class IdentityStore<
  TRegistration extends RegistrationRequest = RegistrationRequest,
  TProfileUpdate extends ProfileUpdate = ProfileUpdate,
> {
  private state: IdentityState = initialState
  private readonly listeners = new Set<Listener>()

  constructor(
    private readonly service: IdentityService<TRegistration, TProfileUpdate>,
    private readonly storage: SessionStorage = new MemorySessionStorage(),
  ) {}

  getSnapshot = (): IdentityState => this.state

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  initialize = async (): Promise<void> => {
    const reference = this.storage.read()
    if (!reference) {
      this.patch({ ...initialState })
      return
    }
    this.patch({ status: 'loading', error: null, sessionError: null, operationError: null })
    try {
      const session = await this.service.restoreSession(reference)
      if (!session) {
        this.storage.clear()
        this.patchSessionFailure(new IdentitySessionError('INVALID_REFERENCE'))
      } else {
        this.patch({
          status: 'authenticated', identity: session.identity, session,
          error: null, sessionError: null, operationError: null,
        })
      }
    } catch (error) {
      this.storage.clear()
      this.patchSessionFailure(toIdentitySessionError(error, 'RESTORE_FAILED'))
    }
  }

  login = async (credentials: Credentials): Promise<Session> => {
    this.patch({ status: 'loading', error: null, sessionError: null, operationError: null })
    try {
      const session = await this.service.login(credentials)
      this.storage.write(session.reference)
      this.patch({
        status: 'authenticated', identity: session.identity, session,
        error: null, sessionError: null, operationError: null,
      })
      return session
    } catch (error) {
      const failure = operationFailure(error, 'AUTHENTICATION')
      this.storage.clear()
      this.patch({
        status: 'error', identity: null, session: null,
        error: failure.message, ...failureCodes(failure),
      })
      throw failure
    }
  }

  register = async (request: TRegistration): Promise<RegistrationResult> => {
    this.patch({ status: 'loading', error: null, sessionError: null, operationError: null })
    try {
      const result = await this.service.register(request)
      if (result.session) this.storage.write(result.session.reference)
      else this.storage.clear()
      this.patch({
        status: result.session ? 'authenticated' : 'idle',
        identity: result.identity,
        session: result.session,
        error: null,
        sessionError: result.session ? null : 'NO_SESSION',
        operationError: null,
      })
      return result
    } catch (error) {
      const failure = operationFailure(error, 'REGISTRATION')
      this.storage.clear()
      this.patch({
        status: 'error', identity: null, session: null,
        error: failure.message, ...failureCodes(failure),
      })
      throw failure
    }
  }

  updateProfile = async (update: TProfileUpdate): Promise<Identity> => {
    if (!this.state.identity || !this.state.session) {
      const failure = new IdentityOperationError('AUTHORIZATION_FAILED', 'PROFILE_UPDATE')
      this.patch({
        status: 'error', identity: null, session: null,
        error: failure.message, sessionError: null, operationError: failure.code,
      })
      throw failure
    }
    this.patch({ status: 'loading', error: null, sessionError: null, operationError: null })
    try {
      const identity = await this.service.updateProfile(this.state.identity, update, this.state.session)
      const session = { ...this.state.session, identity }
      this.patch({
        status: 'authenticated', identity, session,
        error: null, sessionError: null, operationError: null,
      })
      return identity
    } catch (error) {
      const failure = operationFailure(error, 'PROFILE_UPDATE')
      this.patch({
        status: 'error', error: failure.message,
        ...failureCodes(failure),
      })
      throw failure
    }
  }

  remindPassword = async (identifier: string): Promise<void> => {
    const restingStatus: IdentityStoreStatus = this.state.session ? 'authenticated' : 'idle'
    this.patch({ status: 'loading', error: null, sessionError: null, operationError: null })
    try {
      await this.service.remindPassword(identifier)
      this.patch({
        status: restingStatus, error: null,
        sessionError: this.state.session ? null : 'NO_SESSION', operationError: null,
      })
    } catch (error) {
      const failure = operationFailure(error, 'PASSWORD_RECOVERY')
      this.patch({
        status: 'error', error: failure.message,
        ...failureCodes(failure),
      })
      throw failure
    }
  }

  logout = async (): Promise<void> => {
    const session = this.state.session
    let failure: IdentitySessionError | null = null
    try {
      await this.service.logout(session)
    } catch (error) {
      failure = toIdentitySessionError(error, 'LOGOUT_FAILED')
    } finally {
      this.storage.clear()
      this.state = failure
        ? { ...initialState, error: failure.message, sessionError: failure.code }
        : initialState
      this.emit()
    }
    if (failure) throw failure
  }

  hasRole = (role: Role): boolean => this.service.hasRole(this.state.identity, role)

  hasPermission = (permission: Permission): boolean => (
    this.service.hasPermission(this.state.identity, permission)
  )

  capabilities = (): readonly IdentityCapability[] => this.service.capabilities()

  hasCapability = (capability: IdentityCapability): boolean => (
    this.service.hasCapability(capability)
  )

  private patch(patch: Partial<IdentityState>): void {
    this.state = { ...this.state, ...patch }
    this.emit()
  }

  private emit(): void {
    this.listeners.forEach(listener => listener())
  }

  private patchSessionFailure(error: IdentitySessionError): void {
    this.patch({
      status: 'idle', identity: null, session: null,
      error: error.message, sessionError: error.code, operationError: null,
    })
  }
}

function operationFailure(
  error: unknown,
  capability: IdentityCapability,
): IdentityOperationError | IdentitySessionError {
  return error instanceof IdentityOperationError || error instanceof IdentitySessionError
    ? error
    : new IdentityOperationError('PROVIDER_OPERATION_FAILED', capability)
}

function failureCodes(
  error: IdentityOperationError | IdentitySessionError,
): Pick<IdentityState, 'operationError' | 'sessionError'> {
  return error instanceof IdentitySessionError
    ? { operationError: null, sessionError: error.code }
    : { operationError: error.code, sessionError: null }
}
