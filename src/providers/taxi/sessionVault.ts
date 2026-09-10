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
