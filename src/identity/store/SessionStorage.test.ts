import { describe, expect, it } from 'vitest'
import type { SessionReference } from '../model/identity'
import { PersistentSessionStorage, type KeyValueStorage } from './SessionStorage'

class MapStorage implements KeyValueStorage {
  readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

describe('PersistentSessionStorage', () => {
  it('survives adapter recreation and stores only the opaque reference', () => {
    const backing = new MapStorage()
    const reference = 'taxi-session:opaque-id' as SessionReference

    new PersistentSessionStorage(backing).write(reference)
    expect(new PersistentSessionStorage(backing).read()).toBe(reference)
    expect([...backing.values.values()]).toEqual([reference])
    expect(JSON.stringify([...backing.values])).not.toContain('secret-token')
  })

  it('clears a stale reference', () => {
    const backing = new MapStorage()
    const storage = new PersistentSessionStorage(backing)
    storage.write('provider:stale' as SessionReference)
    storage.clear()
    expect(storage.read()).toBeNull()
  })
})
