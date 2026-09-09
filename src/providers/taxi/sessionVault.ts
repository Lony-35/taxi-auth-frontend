import type { SessionReference } from '../../identity'
import type { TaxiTokens } from './types'

/** Provider-owned credential storage. Identity Core only sees the random handle. */
export interface TaxiSessionVault {
  create(tokens: TaxiTokens): SessionReference
  read(reference: SessionReference): TaxiTokens | null
  delete(reference: SessionReference): void
}

export class MemoryTaxiSessionVault implements TaxiSessionVault {
  private readonly sessions = new Map<SessionReference, TaxiTokens>()
  private sequence = 0

  constructor(private readonly createId?: () => string) {}

  create(tokens: TaxiTokens): SessionReference {
    const id = this.createId?.()
      ?? globalThis.crypto?.randomUUID?.()
      ?? `memory-${Date.now()}-${++this.sequence}`
    const reference = `taxi-session:${id}` as SessionReference
    this.sessions.set(reference, { ...tokens })
    return reference
  }

  read(reference: SessionReference): TaxiTokens | null {
    const tokens = this.sessions.get(reference)
    return tokens ? { ...tokens } : null
  }

  delete(reference: SessionReference): void {
    this.sessions.delete(reference)
  }
}
