import type { AuthTokens } from './types'

export interface TokenStorage {
  read(): AuthTokens | null
  write(tokens: AuthTokens): void
  clear(): void
}

function isTokens(value: unknown): value is AuthTokens {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AuthTokens>
  return typeof candidate.token === 'string' && typeof candidate.u_hash === 'string'
}

export class MemoryTokenStorage implements TokenStorage {
  private tokens: AuthTokens | null = null

  read(): AuthTokens | null {
    return this.tokens ? { ...this.tokens } : null
  }

  write(tokens: AuthTokens): void {
    this.tokens = { ...tokens }
  }

  clear(): void {
    this.tokens = null
  }
}

export class LocalTokenStorage implements TokenStorage {
  constructor(
    private readonly storage: Storage,
    private readonly key = 'auth.tokens',
  ) {}

  read(): AuthTokens | null {
    const raw = this.storage.getItem(this.key)
    if (!raw) return null

    try {
      const parsed: unknown = JSON.parse(raw)
      if (isTokens(parsed)) return parsed
    } catch {
      // Повреждённое значение удаляется ниже.
    }

    this.clear()
    return null
  }

  write(tokens: AuthTokens): void {
    this.storage.setItem(this.key, JSON.stringify(tokens))
  }

  clear(): void {
    this.storage.removeItem(this.key)
  }
}

export function createDefaultTokenStorage(): TokenStorage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return new LocalTokenStorage(window.localStorage)
  }
  return new MemoryTokenStorage()
}
