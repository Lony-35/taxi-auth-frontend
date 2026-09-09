import { describe, expect, it, vi } from 'vitest'
import type { TaxiApi, TaxiTokens, TaxiUser } from './types'
import { UserRole } from './types'
import { TaxiIdentityProvider } from './TaxiIdentityProvider'
import { taxiUserToIdentity } from './mapping'
import { MemoryTaxiSessionVault } from './sessionVault'

const user: TaxiUser = {
  u_id: '1', u_name: 'User', u_email: 'u@example.com', u_role: UserRole.Client,
}
const tokens: TaxiTokens = { token: 'token', u_hash: 'hash' }

function taxiApi(): TaxiApi {
  return {
    login: vi.fn().mockResolvedValue({ user, tokens }),
    register: vi.fn().mockResolvedValue({
      userId: '1', emailStatus: true, generatedPassword: null,
      tokens, user, uploadedFileIds: {}, carId: null,
    }),
    remindPassword: vi.fn().mockResolvedValue(undefined),
    checkReferralCode: vi.fn().mockResolvedValue({ exists: true }),
    updateProfile: vi.fn().mockResolvedValue({
      user: { ...user, u_name: 'Updated' }, car: null, uploadedFileIds: {},
    }),
    getAuthorizedCars: vi.fn().mockResolvedValue([]),
    getAuthorizedUser: vi.fn().mockResolvedValue(user),
    logout: vi.fn().mockResolvedValue(undefined),
  }
}

describe('TaxiIdentityProvider', () => {
  it('hides two-step Taxi login behind the provider contract', async () => {
    const api = taxiApi()
    const provider = new TaxiIdentityProvider(api, new MemoryTaxiSessionVault(() => 'login'))
    const session = await provider.login({
      identifier: 'u@example.com', secret: 'secret', kind: 'email',
    })
    expect(api.login).toHaveBeenCalledWith({
      login: 'u@example.com', password: 'secret', type: 'e-mail',
    })
    expect(session.identity).toEqual(taxiUserToIdentity(user))
    expect(session.reference).toBe('taxi-session:login')
    expect(session.reference).not.toContain(tokens.token)
  })

  it('maps universal registration to explicit Taxi registration data', async () => {
    const api = taxiApi()
    const provider = new TaxiIdentityProvider(api, new MemoryTaxiSessionVault(() => 'register'))
    const result = await provider.register({
      credentials: { identifier: 'u@example.com', kind: 'email' },
      profile: { name: 'User', email: 'u@example.com', city: 'Accra' },
      taxi: { role: UserRole.Client, referralCode: 'PARTNER' },
    })
    expect(api.register).toHaveBeenCalledWith(expect.objectContaining({
      u_name: 'User', u_email: 'u@example.com', u_city: 'Accra', ref_code: 'PARTNER',
    }))
    expect(result.identity?.id).toBe('1')
  })

  it('restores and logs out using an opaque session reference', async () => {
    const api = taxiApi()
    const provider = new TaxiIdentityProvider(api, new MemoryTaxiSessionVault(() => 'restore'))
    const reference = (await provider.login({
      identifier: 'u@example.com', secret: 'secret', kind: 'email',
    })).reference
    await expect(provider.restoreSession(reference)).resolves.toMatchObject({ identity: { id: '1' } })
    await provider.logout({ identity: taxiUserToIdentity(user), reference })
    expect(api.getAuthorizedUser).toHaveBeenCalledWith(tokens)
    expect(api.logout).toHaveBeenCalledWith(tokens)
  })

  it('maps universal profile changes through Taxi API', async () => {
    const api = taxiApi()
    const provider = new TaxiIdentityProvider(api, new MemoryTaxiSessionVault(() => 'profile'))
    const session = await provider.login({
      identifier: 'u@example.com', secret: 'secret', kind: 'email',
    })
    await expect(provider.updateProfile(session.identity, {
      profile: { name: 'Updated' },
    }, session)).resolves.toMatchObject({ profile: { name: 'Updated' } })
    expect(api.updateProfile).toHaveBeenCalledWith(
      user,
      { values: { u_name: 'Updated' } },
      tokens,
    )
  })
})
