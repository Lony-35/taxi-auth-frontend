import { describe, expect, it } from 'vitest'
import {
  MemoryTaxiSessionVault,
  PersistentTaxiSessionVault,
  type TaxiCredentialStorage,
} from './sessionVault'

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

  it('restores provider-owned credentials after the vault is recreated', () => {
    const storage = new TestStorage()
    const first = new PersistentTaxiSessionVault(storage, () => 'reload')
    const reference = first.create(tokens())

    const second = new PersistentTaxiSessionVault(storage)
    expect(second.resolve(reference)).toEqual({ status: 'active', tokens: tokens() })
    expect(reference).toBe('taxi-session:reload')
    expect(reference).not.toContain(tokens().token)
    expect(storage.getItem('platform-identity.session-reference')).toBeNull()
  })

  it('removes malformed and expired persistent credential material', () => {
    const storage = new TestStorage()
    const malformedReference = 'taxi-session:malformed' as never
    storage.setItem(
      'taxi.identity.temporary-wa.session:taxi-session:malformed',
      JSON.stringify({ version: 1, tokens: { token: 'secret-token' } }),
    )
    const malformedVault = new PersistentTaxiSessionVault(storage)
    expect(malformedVault.resolve(malformedReference)).toEqual({ status: 'missing', tokens: null })
    expect(storage.values()).not.toContain('secret-token')

    const expiring = new PersistentTaxiSessionVault(storage, () => 'expired', () => 20)
    const expiredReference = expiring.create(tokens(), { expiresAt: 20 })
    expect(expiring.resolve(expiredReference)).toEqual({ status: 'expired', tokens: null })
    expect(expiring.resolve(expiredReference)).toEqual({ status: 'missing', tokens: null })
  })

  it('deletes persistent credentials and returns defensive copies', () => {
    const storage = new TestStorage()
    const vault = new PersistentTaxiSessionVault(storage, () => 'delete')
    const reference = vault.create(tokens())
    const exposed = vault.read(reference)!
    exposed.token = 'changed'
    expect(vault.read(reference)).toEqual(tokens())
    vault.delete(reference)
    expect(vault.read(reference)).toBeNull()
    expect(storage.values()).not.toContain('secret-token')
  })
})

function tokens() {
  return { token: 'secret-token', u_hash: 'secret-hash' }
}

export class TestStorage implements TaxiCredentialStorage {
  private readonly items = new Map<string, string>()

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }

  values(): string {
    return [...this.items.values()].join('\n')
  }
}
