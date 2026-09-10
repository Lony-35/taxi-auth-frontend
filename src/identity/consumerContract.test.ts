import { describe, expect, it, vi } from 'vitest'
import {
  FakeIdentityProvider,
  IdentityOperationError,
  IdentitySessionError,
  IdentityService,
  IdentityStore,
  LimitedFakeIdentityProvider,
  MemorySessionStorage,
  type IdentityCapability,
  type IdentityProvider,
} from './index'

const credentials = {
  identifier: 'demo@example.com', secret: 'demo', kind: 'email' as const,
}

describe('public Identity consumer contract', () => {
  it('runs the full consumer lifecycle without any provider-specific import', async () => {
    const provider: IdentityProvider = new FakeIdentityProvider()
    const storage = new MemorySessionStorage()
    const store = new IdentityStore(new IdentityService(provider), storage)

    expect(store.getSnapshot()).toMatchObject({
      status: 'idle', sessionError: 'NO_SESSION', operationError: null,
    })
    expect(store.hasCapability('AUTHENTICATION')).toBe(true)

    await store.login(credentials)
    expect(store.hasRole('driver')).toBe(true)
    expect(store.hasPermission('profile.update')).toBe(true)

    await store.updateProfile({ profile: { name: 'Consumer' } })
    expect(store.getSnapshot().identity?.profile.name).toBe('Consumer')
    await store.remindPassword('demo@example.com')

    const restored = new IdentityStore(new IdentityService(provider), storage)
    await restored.initialize()
    expect(restored.getSnapshot().status).toBe('authenticated')

    await restored.logout()
    expect(restored.getSnapshot()).toMatchObject({
      status: 'idle', identity: null, session: null,
      sessionError: 'NO_SESSION', operationError: null,
    })

    await restored.register({
      credentials: { identifier: 'new@example.com', kind: 'email' },
      profile: { name: 'Registered', email: 'new@example.com' },
    })
    expect(restored.getSnapshot()).toMatchObject({
      status: 'authenticated', identity: { id: 'fake-registered', roles: ['client'] },
    })
  })

  it('keeps capability discovery deterministic, identity-independent and immutable', async () => {
    const declaration: IdentityCapability[] = ['AUTHENTICATION', 'ACL']
    const provider: IdentityProvider = {
      capabilities: () => declaration,
      login: async () => new FakeIdentityProvider().login!(credentials),
    }
    const store = new IdentityStore(new IdentityService(provider))
    const before = store.capabilities()
    expect(Object.isFrozen(before)).toBe(true)
    expect(() => (before as IdentityCapability[]).push('LOGOUT')).toThrow()

    declaration.push('LOGOUT')
    await store.login(credentials)
    expect(store.capabilities()).toEqual(['AUTHENTICATION', 'ACL'])
    expect(store.hasCapability('LOGOUT')).toBe(false)
    expect(store.hasPermission('profile.update')).toBe(true)
  })

  it('exposes unsupported Limited Provider recovery without invoking it or faking success', async () => {
    const provider = new LimitedFakeIdentityProvider()
    const recovery = vi.spyOn(provider, 'remindPassword')
    const store = new IdentityStore(new IdentityService(provider))

    await expect(store.remindPassword('demo@example.com')).rejects.toEqual(
      new IdentityOperationError('UNSUPPORTED_CAPABILITY', 'PASSWORD_RECOVERY'),
    )
    expect(recovery).not.toHaveBeenCalled()
    expect(store.getSnapshot()).toMatchObject({
      status: 'error', error: 'Identity capability is not supported',
      operationError: 'UNSUPPORTED_CAPABILITY', sessionError: null,
    })
  })

  it('never leaks an unknown provider error through Store', async () => {
    const provider = new FakeIdentityProvider()
    vi.spyOn(provider, 'register').mockRejectedValue(new Error('transport secret-token'))
    const store = new IdentityStore(new IdentityService(provider))
    const failure = store.register({
      credentials: { identifier: 'new@example.com', kind: 'email' }, profile: {},
    })

    await expect(failure).rejects.toMatchObject({
      code: 'PROVIDER_OPERATION_FAILED', message: 'Identity provider operation failed',
    })
    expect(JSON.stringify(store.getSnapshot())).not.toContain('secret-token')
  })

  it('does not transform an already normalized session error', async () => {
    const provider = new FakeIdentityProvider()
    const expected = new IdentitySessionError('INVALID_PROVIDER_CREDENTIALS')
    vi.spyOn(provider, 'login').mockRejectedValue(expected)
    const store = new IdentityStore(new IdentityService(provider))

    await expect(store.login(credentials)).rejects.toBe(expected)
    expect(store.getSnapshot()).toMatchObject({
      status: 'error', sessionError: 'INVALID_PROVIDER_CREDENTIALS', operationError: null,
    })
  })
})
