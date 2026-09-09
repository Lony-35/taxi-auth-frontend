import { describe, expect, it } from 'vitest'
import { MemoryTaxiSessionVault } from './sessionVault'

describe('TaxiSessionVault', () => {
  it('keeps credentials behind an opaque random handle', () => {
    const vault = new MemoryTaxiSessionVault(() => 'opaque-id')
    const tokens = { token: 'secret-token', u_hash: 'secret-hash' }
    const reference = vault.create(tokens)

    expect(reference).toBe('taxi-session:opaque-id')
    expect(reference).not.toContain(tokens.token)
    expect(reference).not.toContain(tokens.u_hash)
    expect(vault.read(reference)).toEqual(tokens)

    vault.delete(reference)
    expect(vault.read(reference)).toBeNull()
  })
})
