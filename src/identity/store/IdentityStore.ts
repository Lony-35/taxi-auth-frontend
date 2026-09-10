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

export type IdentityStoreStatus = 'idle' | 'loading' | 'authenticated' | 'error'

export interface IdentityState {
  status: IdentityStoreStatus
  identity: Identity | null
  session: Session | null
  error: string | null
  sessionError: SessionErrorCode | null
}

type Listener = () => void

const initialState: IdentityState = {
  status: 'idle', identity: null, session: null, error: null, sessionError: 'NO_SESSION',
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
    this.patch({ status: 'loading', error: null, sessionError: null })
    try {
      const session = await this.service.restoreSession(reference)
      if (!session) {
        this.storage.clear()
        this.patchSessionFailure(new IdentitySessionError('INVALID_REFERENCE'))
      } else {
        this.patch({
          status: 'authenticated', identity: session.identity, session,
          error: null, sessionError: null,
        })
      }
    } catch (error) {
      this.storage.clear()
      this.patchSessionFailure(toIdentitySessionError(error, 'RESTORE_FAILED'))
    }
  }

  login = async (credentials: Credentials): Promise<Session> => {
    this.patch({ status: 'loading', error: null, sessionError: null })
    try {
      const session = await this.service.login(credentials)
      this.storage.write(session.reference)
      this.patch({
        status: 'authenticated', identity: session.identity, session,
        error: null, sessionError: null,
      })
      return session
    } catch (error) {
      this.storage.clear()
      this.patch({
        status: 'error', identity: null, session: null,
        error: errorMessage(error), sessionError: null,
      })
      throw error
    }
  }

  register = async (request: TRegistration): Promise<RegistrationResult> => {
    this.patch({ status: 'loading', error: null, sessionError: null })
    try {
      const result = await this.service.register(request)
      if (result.session) this.storage.write(result.session.reference)
      this.patch({
        status: result.session ? 'authenticated' : 'idle',
        identity: result.identity,
        session: result.session,
        error: null,
        sessionError: result.session ? null : 'NO_SESSION',
      })
      return result
    } catch (error) {
      this.patch({ status: 'error', error: errorMessage(error), sessionError: null })
      throw error
    }
  }

  updateProfile = async (update: TProfileUpdate): Promise<Identity> => {
    if (!this.state.identity || !this.state.session) throw new Error('Identity is not authenticated')
    this.patch({ status: 'loading', error: null, sessionError: null })
    try {
      const identity = await this.service.updateProfile(this.state.identity, update, this.state.session)
      const session = { ...this.state.session, identity }
      this.patch({ status: 'authenticated', identity, session, error: null, sessionError: null })
      return identity
    } catch (error) {
      this.patch({ status: 'error', error: errorMessage(error) })
      throw error
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
      error: error.message, sessionError: error.code,
    })
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
