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

  it('keeps sessions isolated and returns defensive credential copies', () => {
    const ids = ['first', 'second']
    const vault = new MemoryTaxiSessionVault(() => ids.shift()!)
    const first = vault.create({ token: 'one', u_hash: 'hash-one' })
    const second = vault.create({ token: 'two', u_hash: 'hash-two' })

    const exposed = vault.read(first)!
    exposed.token = 'changed'
    expect(vault.read(first)?.token).toBe('one')
    expect(vault.read(second)?.token).toBe('two')
  })

  it('distinguishes and removes expired credentials', () => {
    let now = 100
    const vault = new MemoryTaxiSessionVault(() => 'expiring', () => now)
    const reference = vault.create(tokens(), { expiresAt: 200 })
    expect(vault.resolve(reference).status).toBe('active')
    now = 200
    expect(vault.resolve(reference)).toEqual({ status: 'expired', tokens: null })
    expect(vault.resolve(reference)).toEqual({ status: 'missing', tokens: null })
  })

  it('rejects duplicate opaque references instead of mixing credentials', () => {
    const vault = new MemoryTaxiSessionVault(() => 'same')
    vault.create(tokens())
    expect(() => vault.create(tokens())).toThrow('Duplicate Taxi session reference')
  })
})

function tokens() {
  return { token: 'secret-token', u_hash: 'secret-hash' }
}
