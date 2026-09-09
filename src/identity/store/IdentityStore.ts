import type { IdentityService } from '../service/IdentityService'
import { MemorySessionStorage, type SessionStorage } from './SessionStorage'
import type {
  Credentials,
  Identity,
  ProfileUpdate,
  RegistrationRequest,
  RegistrationResult,
  Session,
} from '../model/identity'

export type IdentityStoreStatus = 'idle' | 'loading' | 'authenticated' | 'error'

export interface IdentityState {
  status: IdentityStoreStatus
  identity: Identity | null
  session: Session | null
  error: string | null
}

type Listener = () => void

const initialState: IdentityState = {
  status: 'idle', identity: null, session: null, error: null,
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
    if (!reference) return
    this.patch({ status: 'loading', error: null })
    try {
      const session = await this.service.restoreSession(reference)
      if (!session) {
        this.storage.clear()
        this.state = initialState
      } else {
        this.patch({ status: 'authenticated', identity: session.identity, session, error: null })
      }
    } catch (error) {
      this.storage.clear()
      this.patch({ ...initialState, error: errorMessage(error) })
    }
  }

  login = async (credentials: Credentials): Promise<Session> => {
    this.patch({ status: 'loading', error: null })
    try {
      const session = await this.service.login(credentials)
      this.storage.write(session.reference)
      this.patch({ status: 'authenticated', identity: session.identity, session, error: null })
      return session
    } catch (error) {
      this.storage.clear()
      this.patch({ status: 'error', identity: null, session: null, error: errorMessage(error) })
      throw error
    }
  }

  register = async (request: TRegistration): Promise<RegistrationResult> => {
    this.patch({ status: 'loading', error: null })
    try {
      const result = await this.service.register(request)
      if (result.session) this.storage.write(result.session.reference)
      this.patch({
        status: result.session ? 'authenticated' : 'idle',
        identity: result.identity,
        session: result.session,
        error: null,
      })
      return result
    } catch (error) {
      this.patch({ status: 'error', error: errorMessage(error) })
      throw error
    }
  }

  updateProfile = async (update: TProfileUpdate): Promise<Identity> => {
    if (!this.state.identity || !this.state.session) throw new Error('Identity is not authenticated')
    this.patch({ status: 'loading', error: null })
    try {
      const identity = await this.service.updateProfile(this.state.identity, update, this.state.session)
      const session = { ...this.state.session, identity }
      this.patch({ status: 'authenticated', identity, session, error: null })
      return identity
    } catch (error) {
      this.patch({ status: 'error', error: errorMessage(error) })
      throw error
    }
  }

  logout = async (): Promise<void> => {
    const session = this.state.session
    try {
      await this.service.logout(session)
    } finally {
      this.storage.clear()
      this.state = initialState
      this.emit()
    }
  }

  private patch(patch: Partial<IdentityState>): void {
    this.state = { ...this.state, ...patch }
    this.emit()
  }

  private emit(): void {
    this.listeners.forEach(listener => listener())
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
