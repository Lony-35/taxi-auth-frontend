import type { SessionReference } from '../../identity'
import type { TaxiTokens } from './types'

/** Provider-owned credential storage. Identity Core only sees the random handle. */
export interface TaxiSessionVault {
  create(tokens: TaxiTokens, options?: { expiresAt?: number }): SessionReference
  read(reference: SessionReference): TaxiTokens | null
  resolve(reference: SessionReference): TaxiSessionResolution
  delete(reference: SessionReference): void
}

export type TaxiSessionResolution =
  | { status: 'active'; tokens: TaxiTokens }
  | { status: 'missing'; tokens: null }
  | { status: 'expired'; tokens: null }

interface TaxiSessionEntry {
  tokens: TaxiTokens
  expiresAt?: number
}

/** Minimal storage surface owned by the Taxi adapter, never by Identity Core. */
export interface TaxiCredentialStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface PersistedTaxiSessionEntry extends TaxiSessionEntry {
  version: 1
}

export class MemoryTaxiSessionVault implements TaxiSessionVault {
  private readonly sessions = new Map<SessionReference, TaxiSessionEntry>()

  constructor(
    private readonly createId?: () => string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  create(tokens: TaxiTokens, options: { expiresAt?: number } = {}): SessionReference {
    const id = this.createId?.() ?? globalThis.crypto?.randomUUID?.()
    if (!id) throw new Error('Secure random session reference generation is unavailable')
    const reference = `taxi-session:${id}` as SessionReference
    if (this.sessions.has(reference)) throw new Error('Duplicate Taxi session reference')
    this.sessions.set(reference, { tokens: { ...tokens }, expiresAt: options.expiresAt })
    return reference
  }

  read(reference: SessionReference): TaxiTokens | null {
    const result = this.resolve(reference)
    return result.status === 'active' ? result.tokens : null
  }

  resolve(reference: SessionReference): TaxiSessionResolution {
    const entry = this.sessions.get(reference)
    if (!entry) return { status: 'missing', tokens: null }
    if (entry.expiresAt !== undefined && entry.expiresAt <= this.now()) {
      this.sessions.delete(reference)
      return { status: 'expired', tokens: null }
    }
    return { status: 'active', tokens: { ...entry.tokens } }
  }

  delete(reference: SessionReference): void {
    this.sessions.delete(reference)
  }
}

/**
 * TEMPORARY WA — REMOVE AFTER BACKEND-OWNED SESSION.
 *
 * The current Taxi backend cannot restore a browser session without its bearer
 * credentials. This provider-owned vault is therefore intentionally the only
 * place where credential-bearing state survives a reload. It must be removed
 * when Taxi exposes a Secure/HttpOnly backend session.
 */
export class PersistentTaxiSessionVault implements TaxiSessionVault {
  constructor(
    private readonly storage: TaxiCredentialStorage,
    private readonly createId?: () => string,
    private readonly now: () => number = () => Date.now(),
    private readonly keyPrefix = 'taxi.identity.temporary-wa.session:',
  ) {}

  create(tokens: TaxiTokens, options: { expiresAt?: number } = {}): SessionReference {
    const id = this.createId?.() ?? globalThis.crypto?.randomUUID?.()
    if (!id) throw new Error('Secure random session reference generation is unavailable')
    const reference = `taxi-session:${id}` as SessionReference
    const key = this.key(reference)
    if (this.storage.getItem(key) !== null) throw new Error('Duplicate Taxi session reference')
    const entry: PersistedTaxiSessionEntry = {
      version: 1,
      tokens: { ...tokens },
      ...(options.expiresAt === undefined ? {} : { expiresAt: options.expiresAt }),
    }
    this.storage.setItem(key, JSON.stringify(entry))
    return reference
  }

  read(reference: SessionReference): TaxiTokens | null {
    const result = this.resolve(reference)
    return result.status === 'active' ? result.tokens : null
  }

  resolve(reference: SessionReference): TaxiSessionResolution {
    const key = this.key(reference)
    const raw = this.storage.getItem(key)
    if (!raw) return { status: 'missing', tokens: null }

    const entry = parseEntry(raw)
    if (!entry) {
      this.storage.removeItem(key)
      return { status: 'missing', tokens: null }
    }
    if (entry.expiresAt !== undefined && entry.expiresAt <= this.now()) {
      this.storage.removeItem(key)
      return { status: 'expired', tokens: null }
    }
    return { status: 'active', tokens: { ...entry.tokens } }
  }

  delete(reference: SessionReference): void {
    this.storage.removeItem(this.key(reference))
  }

  private key(reference: SessionReference): string {
    return `${this.keyPrefix}${reference}`
  }
}

/** Selects the temporary browser vault only when browser storage is available. */
export function createDefaultTaxiSessionVault(): TaxiSessionVault {
  const storage = browserStorage()
  return storage ? new PersistentTaxiSessionVault(storage) : new MemoryTaxiSessionVault()
}

function browserStorage(): TaxiCredentialStorage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function parseEntry(raw: string): PersistedTaxiSessionEntry | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const entry = value as Partial<PersistedTaxiSessionEntry>
    if (entry.version !== 1 || !entry.tokens || typeof entry.tokens !== 'object') return null
    if (typeof entry.tokens.token !== 'string' || typeof entry.tokens.u_hash !== 'string') return null
    if (entry.expiresAt !== undefined && typeof entry.expiresAt !== 'number') return null
    return {
      version: 1,
      tokens: { token: entry.tokens.token, u_hash: entry.tokens.u_hash },
      ...(entry.expiresAt === undefined ? {} : { expiresAt: entry.expiresAt }),
    }
  } catch {
    return null
  }
}
