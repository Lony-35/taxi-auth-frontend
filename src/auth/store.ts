import { toErrorMessage } from './errors'
import { createDefaultTokenStorage, type TokenStorage } from './storage'
import type {
  AuthListener,
  AuthService,
  AuthState,
  LoginRequest,
  RegisterRequest,
  RegisterResult,
  ReferralCodeResult,
} from './types'

const initialState: AuthState = {
  status: 'idle',
  user: null,
  tokens: null,
  error: null,
  registration: null,
}

export class AuthStore {
  private state: AuthState = initialState
  private readonly listeners = new Set<AuthListener>()

  constructor(
    private readonly client: AuthService,
    private readonly storage: TokenStorage = createDefaultTokenStorage(),
  ) {}

  getSnapshot = (): AuthState => this.state

  subscribe = (listener: AuthListener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  initialize = async (): Promise<void> => {
    const tokens = this.storage.read()
    if (!tokens) return
    this.patch({ status: 'loading', error: null, tokens })
    try {
      const user = await this.client.getAuthorizedUser(tokens)
      this.patch({ status: 'authenticated', user, tokens, error: null })
    } catch (error) {
      this.storage.clear()
      this.patch({ ...initialState, error: toErrorMessage(error) })
    }
  }

  login = async (request: LoginRequest): Promise<void> => {
    this.patch({ status: 'loading', user: null, tokens: null, error: null })
    try {
      const session = await this.client.login(request)
      this.storage.write(session.tokens)
      this.patch({
        status: 'authenticated',
        user: session.user,
        tokens: session.tokens,
        error: null,
        registration: null,
      })
    } catch (error) {
      this.storage.clear()
      this.patch({ status: 'error', error: toErrorMessage(error) })
      throw error
    }
  }

  register = async (request: RegisterRequest): Promise<RegisterResult> => {
    this.storage.clear()
    this.patch({ status: 'loading', error: null, registration: null })
    try {
      const result = await this.client.register(request)
      if (result.tokens) this.storage.write(result.tokens)
      this.patch({
        status: result.user && result.tokens ? 'authenticated' : 'idle',
        user: result.user,
        tokens: result.tokens,
        error: null,
        registration: result,
      })
      return result
    } catch (error) {
      this.patch({ status: 'error', error: toErrorMessage(error) })
      throw error
    }
  }

  remindPassword = async (email: string): Promise<void> => {
    this.patch({ status: 'loading', error: null })
    try {
      await this.client.remindPassword(email)
      this.patch({ status: this.state.user ? 'authenticated' : 'idle', error: null })
    } catch (error) {
      this.patch({ status: 'error', error: toErrorMessage(error) })
      throw error
    }
  }

  checkReferralCode = (code: string): Promise<ReferralCodeResult> => {
    return this.client.checkReferralCode(code)
  }

  logout = async (): Promise<void> => {
    const tokens = this.state.tokens
    this.patch({ status: 'loading', error: null })
    try {
      await this.client.logout(tokens)
    } catch {
      // Локальная сессия должна завершиться даже при недоступном сервере.
    } finally {
      this.storage.clear()
      this.state = initialState
      this.emit()
    }
  }

  clearError = (): void => {
    this.patch({ error: null, status: this.state.user ? 'authenticated' : 'idle' })
  }

  private patch(patch: Partial<AuthState>): void {
    this.state = { ...this.state, ...patch }
    this.emit()
  }

  private emit(): void {
    this.listeners.forEach(listener => listener())
  }
}
