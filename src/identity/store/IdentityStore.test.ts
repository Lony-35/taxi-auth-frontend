import { describe, expect, it } from 'vitest'
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
      status: 'authenticated', identity: { id: 'fake-identity' },
    })

    const restored = new IdentityStore(service, storage)
    await restored.initialize()
    expect(restored.getSnapshot()).toMatchObject({
      status: 'authenticated', identity: { id: 'fake-identity' },
    })
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
})
