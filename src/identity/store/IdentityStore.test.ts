import { describe, expect, it, vi } from 'vitest'
import type { SessionReference } from '../model/identity'
import { IdentitySessionError } from '../model/sessionError'
import { FakeIdentityProvider } from '../provider/FakeIdentityProvider'
import { IdentityService } from '../service/IdentityService'
import { IdentityStore } from './IdentityStore'
import { MemorySessionStorage } from './SessionStorage'

describe('IdentityStore provider independence', () => {
  it('supports login and restore using FakeIdentityProvider without a concrete backend', async () => {
    const provider = new FakeIdentityProvider()
    const service = new IdentityService(provider)
    const storage = new MemorySessionStorage()
    const store = new IdentityStore(service, storage)

    await store.login({ identifier: 'demo@example.com', secret: 'demo', kind: 'email' })
    expect(store.getSnapshot()).toMatchObject({
      status: 'authenticated', identity: {
        id: 'fake-identity', roles: ['driver'],
        permissions: ['orders.read', 'orders.accept', 'profile.read', 'profile.update'],
      },
    })
    expect(store.hasRole('driver')).toBe(true)
    expect(store.hasRole('client')).toBe(false)
    expect(store.hasPermission('profile.update')).toBe(true)
    expect(store.hasPermission('users.delete')).toBe(false)
    expect(store.hasCapability('PROFILE_UPDATE')).toBe(true)
    expect(store.capabilities()).toContain('ACL')

    const restored = new IdentityStore(service, storage)
    await restored.initialize()
    expect(restored.getSnapshot()).toMatchObject({
      status: 'authenticated', identity: {
        id: 'fake-identity', roles: ['driver'], permissions: expect.arrayContaining(['profile.update']),
      },
    })
    expect(restored.hasRole('driver')).toBe(true)
    expect(restored.hasPermission('orders.accept')).toBe(true)
  })

  it('supports registration, profile update and logout through the same contract', async () => {
    const store = new IdentityStore(new IdentityService(new FakeIdentityProvider()))
    await store.register({
      credentials: { identifier: 'new@example.com', kind: 'email' },
      profile: { name: 'New', email: 'new@example.com' },
    })
    await store.updateProfile({ profile: { name: 'Updated' } })
    expect(store.getSnapshot().identity?.profile.name).toBe('Updated')
    await store.logout()
    expect(store.getSnapshot()).toMatchObject({ status: 'idle', identity: null, session: null })
  })

  it('reports NO_SESSION without calling the provider', async () => {
    const provider = new FakeIdentityProvider()
    const restore = vi.spyOn(provider, 'restoreSession')
    const store = new IdentityStore(new IdentityService(provider), new MemorySessionStorage())
    await store.initialize()
    expect(restore).not.toHaveBeenCalled()
    expect(store.getSnapshot()).toMatchObject({ status: 'idle', sessionError: 'NO_SESSION' })
  })

  it('clears an invalid persisted reference and returns to idle', async () => {
    const storage = new MemorySessionStorage()
    storage.write('stale' as SessionReference)
    const store = new IdentityStore(new IdentityService(new FakeIdentityProvider()), storage)
    await store.initialize()
    expect(storage.read()).toBeNull()
    expect(store.getSnapshot()).toMatchObject({
      status: 'idle', identity: null, session: null, sessionError: 'INVALID_REFERENCE',
    })
  })

  it('preserves a provider-neutral restore code without exposing provider secrets', async () => {
    const provider = new FakeIdentityProvider()
    vi.spyOn(provider, 'restoreSession').mockRejectedValue(new IdentitySessionError('EXPIRED_SESSION'))
    const storage = new MemorySessionStorage()
    storage.write('expired' as SessionReference)
    const store = new IdentityStore(new IdentityService(provider), storage)
    await store.initialize()
    expect(storage.read()).toBeNull()
    expect(store.getSnapshot()).toMatchObject({
      status: 'idle', error: 'Session has expired', sessionError: 'EXPIRED_SESSION',
    })
  })

  it('sanitizes unknown restore failures and always clears the reference', async () => {
    const provider = new FakeIdentityProvider()
    vi.spyOn(provider, 'restoreSession').mockRejectedValue(new Error('secret-token'))
    const storage = new MemorySessionStorage()
    storage.write('failing' as SessionReference)
    const store = new IdentityStore(new IdentityService(provider), storage)
    await store.initialize()
    expect(storage.read()).toBeNull()
    expect(store.getSnapshot()).toMatchObject({
      status: 'idle', error: 'Session restore failed', sessionError: 'RESTORE_FAILED',
    })
    expect(JSON.stringify(store.getSnapshot())).not.toContain('secret-token')
  })

  it('clears local state even when provider logout fails', async () => {
    const provider = new FakeIdentityProvider()
    vi.spyOn(provider, 'logout').mockRejectedValue(new Error('secret-token'))
    const storage = new MemorySessionStorage()
    const store = new IdentityStore(new IdentityService(provider), storage)
    await store.login({ identifier: 'demo@example.com', secret: 'demo', kind: 'email' })
    await expect(store.logout()).rejects.toMatchObject({ code: 'LOGOUT_FAILED' })
    expect(storage.read()).toBeNull()
    expect(store.getSnapshot()).toMatchObject({
      status: 'idle', identity: null, session: null,
      error: 'Session logout failed', sessionError: 'LOGOUT_FAILED',
    })
    expect(JSON.stringify(store.getSnapshot())).not.toContain('secret-token')
  })
})
