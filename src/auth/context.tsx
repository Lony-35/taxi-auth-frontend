import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'
import { AuthStore } from './store'
import type { TokenStorage } from './storage'
import type { AuthService, LoginRequest, RegisterRequest, RegisterResult } from './types'

interface AuthContextValue {
  store: AuthStore
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps extends PropsWithChildren {
  client: AuthService
  storage?: TokenStorage
}

export function AuthProvider({ client, storage, children }: AuthProviderProps) {
  const store = useMemo(() => new AuthStore(client, storage), [client, storage])

  useEffect(() => {
    void store.initialize()
  }, [store])

  return <AuthContext.Provider value={{ store }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth должен вызываться внутри AuthProvider')

  const state = useSyncExternalStore(
    context.store.subscribe,
    context.store.getSnapshot,
    context.store.getSnapshot,
  )

  return {
    state,
    login: (request: LoginRequest): Promise<void> => context.store.login(request),
    register: (request: RegisterRequest): Promise<RegisterResult> => context.store.register(request),
    remindPassword: (email: string): Promise<void> => context.store.remindPassword(email),
    checkReferralCode: (code: string) => context.store.checkReferralCode(code),
    logout: (): Promise<void> => context.store.logout(),
    clearError: (): void => context.store.clearError(),
  }
}
