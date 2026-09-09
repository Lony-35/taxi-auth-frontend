import { describe, expect, it } from 'vitest'
import { LocalTokenStorage, MemoryTokenStorage } from './storage'

class FakeStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('TokenStorage', () => {
  it('копирует значения в памяти', () => {
    const storage = new MemoryTokenStorage()
    const tokens = { token: 'a', u_hash: 'b' }
    storage.write(tokens)
    tokens.token = 'changed'
    expect(storage.read()).toEqual({ token: 'a', u_hash: 'b' })
  })

  it('удаляет повреждённые данные localStorage', () => {
    const raw = new FakeStorage()
    raw.setItem('auth.tokens', '{broken')
    const storage = new LocalTokenStorage(raw)
    expect(storage.read()).toBeNull()
    expect(raw.getItem('auth.tokens')).toBeNull()
  })
})
