import type { SessionReference } from '../model/identity'

export interface SessionStorage {
  read(): SessionReference | null
  write(reference: SessionReference): void
  clear(): void
}

/** Minimal adapter implemented by browser localStorage and equivalent durable stores. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Persists only the opaque, non-secret reference; never provider credentials. */
export class PersistentSessionStorage implements SessionStorage {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key = 'platform-identity.session-reference',
  ) {}

  read(): SessionReference | null {
    const value = this.storage.getItem(this.key)
    return value ? value as SessionReference : null
  }

  write(reference: SessionReference): void {
    this.storage.setItem(this.key, reference)
  }

  clear(): void {
    this.storage.removeItem(this.key)
  }
}

export class MemorySessionStorage implements SessionStorage {
  private reference: SessionReference | null = null

  read(): SessionReference | null {
    return this.reference
  }

  write(reference: SessionReference): void {
    this.reference = reference
  }

  clear(): void {
    this.reference = null
  }
}
