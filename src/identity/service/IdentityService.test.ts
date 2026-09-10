import { describe, expect, it, vi } from 'vitest'
import type { IdentityProvider } from '../contract/IdentityProvider'
import { FakeIdentityProvider, LimitedFakeIdentityProvider } from '../provider/FakeIdentityProvider'
import { IdentityOperationError } from '../model/operationError'
import { IdentityService } from './IdentityService'

describe('Identity provider capabilities', () => {
  it('discovers the full fake provider capability set independently of permissions', () => {
    const service = new IdentityService(new FakeIdentityProvider())
    expect(service.capabilities()).toEqual([
      'AUTHENTICATION', 'REGISTRATION', 'SESSION_RESTORE', 'PROFILE_READ',
      'PROFILE_UPDATE', 'PASSWORD_RECOVERY', 'LOGOUT', 'ACL',
    ])
    expect(service.hasCapability('PASSWORD_RECOVERY')).toBe(true)
  })

  it('rejects an unsupported operation before invoking the limited provider', async () => {
    const provider = new LimitedFakeIdentityProvider()
    const operation = vi.spyOn(provider, 'remindPassword')
    const service = new IdentityService(provider)

    expect(service.hasCapability('PASSWORD_RECOVERY')).toBe(false)
    await expect(service.remindPassword('user@example.com')).rejects.toMatchObject({
      code: 'UNSUPPORTED_CAPABILITY',
      capability: 'PASSWORD_RECOVERY',
      message: 'Identity capability is not supported',
    })
    expect(operation).not.toHaveBeenCalled()
  })

  it('allows a provider to omit an unsupported operation from the contract', async () => {
    const provider: IdentityProvider = { capabilities: () => [] }
    const service = new IdentityService(provider)
    await expect(service.remindPassword('user@example.com')).rejects.toMatchObject({
      code: 'UNSUPPORTED_CAPABILITY', capability: 'PASSWORD_RECOVERY',
    })
  })

  it('separates authentication failure from an unknown provider failure', async () => {
    const ordinary = new IdentityService(new FakeIdentityProvider())
    await expect(ordinary.login({
      identifier: 'demo@example.com', secret: 'wrong', kind: 'email',
    })).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' })

    const provider = new FakeIdentityProvider()
    vi.spyOn(provider, 'login').mockRejectedValue(new Error('Taxi secret-token response'))
    const service = new IdentityService(provider)
    const failure = service.login({ identifier: 'demo@example.com', secret: 'demo', kind: 'email' })
    await expect(failure).rejects.toMatchObject({
      code: 'PROVIDER_OPERATION_FAILED', message: 'Identity provider operation failed',
    })
    await expect(failure).rejects.not.toHaveProperty('cause')
  })

  it('preserves explicit provider-neutral validation failures', async () => {
    const provider = new FakeIdentityProvider()
    vi.spyOn(provider, 'register').mockRejectedValue(
      new IdentityOperationError('VALIDATION_FAILED', 'REGISTRATION'),
    )
    const service = new IdentityService(provider)
    await expect(service.register({ credentials: {
      identifier: 'bad', kind: 'email',
    }, profile: {} })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('preserves explicit provider-neutral authorization failures', async () => {
    const provider = new FakeIdentityProvider()
    vi.spyOn(provider, 'updateProfile').mockRejectedValue(
      new IdentityOperationError('AUTHORIZATION_FAILED', 'PROFILE_UPDATE'),
    )
    const service = new IdentityService(provider)
    const session = await service.login({
      identifier: 'demo@example.com', secret: 'demo', kind: 'email',
    })
    await expect(service.updateProfile(session.identity, { profile: {} }, session))
      .rejects.toMatchObject({ code: 'AUTHORIZATION_FAILED' })
  })
})
