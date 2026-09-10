import { describe, expect, it, vi } from 'vitest'
import type { TaxiApi, TaxiTokens, TaxiUser } from './types'
import { UserRole } from './types'
import { TaxiIdentityProvider } from './TaxiIdentityProvider'
import { taxiUserToIdentity } from './mapping'
import {
  MemoryTaxiSessionVault,
  PersistentTaxiSessionVault,
  type TaxiCredentialStorage,
} from './sessionVault'
import { TaxiApiError } from './errors'
import {
  IdentityService,
  IdentityStore,
  PersistentSessionStorage,
  type SessionReference,
} from '../../identity'

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
  it('declares only capabilities confirmed by the current Taxi API adapter', () => {
    const provider = new TaxiIdentityProvider(taxiApi())
    expect(provider.capabilities()).toEqual([
      'AUTHENTICATION', 'REGISTRATION', 'SESSION_RESTORE', 'PROFILE_READ',
      'PROFILE_UPDATE', 'PASSWORD_RECOVERY', 'LOGOUT', 'ACL',
    ])
  })

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
    expect(session.identity.roles).toEqual(['client'])
    expect(session.identity.permissions).toEqual([])
    expect(session.reference).toBe('taxi-session:login')
    expect(session.reference).not.toContain(tokens.token)
  })

  it('maps known Taxi authentication errors without leaking provider details', async () => {
    const api = taxiApi()
    vi.mocked(api.login).mockRejectedValue(
      new TaxiApiError('backend leaked secret-token', 'wrong_password'),
    )
    const provider = new TaxiIdentityProvider(api)
    await expect(provider.login({
      identifier: 'u@example.com', secret: 'wrong', kind: 'email',
    })).rejects.toMatchObject({
      code: 'AUTHENTICATION_FAILED', message: 'Authentication failed',
    })
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
    expect(result.identity?.roles).toEqual(['client'])
  })

  it('restores and logs out using an opaque session reference', async () => {
    const api = taxiApi()
    const provider = new TaxiIdentityProvider(api, new MemoryTaxiSessionVault(() => 'restore'))
    const reference = (await provider.login({
      identifier: 'u@example.com', secret: 'secret', kind: 'email',
    })).reference
    await expect(provider.restoreSession(reference)).resolves.toMatchObject({
      identity: { id: '1', roles: ['client'], permissions: [] },
    })
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

  it('keeps password recovery and ACL behavior behind the Identity contract', async () => {
    const api = taxiApi()
    const provider = new TaxiIdentityProvider(api)
    await provider.remindPassword('u@example.com')
    expect(api.remindPassword).toHaveBeenCalledWith('u@example.com')
    expect(taxiUserToIdentity(user)).toMatchObject({ roles: ['client'], permissions: [] })
  })

  it('distinguishes missing and expired session references', async () => {
    const api = taxiApi()
    const vault = new MemoryTaxiSessionVault(() => 'expired', () => 10)
    const provider = new TaxiIdentityProvider(api, vault)
    await expect(provider.restoreSession('unknown' as SessionReference))
      .rejects.toMatchObject({ code: 'INVALID_REFERENCE' })
    const expired = vault.create(tokens, { expiresAt: 10 })
    await expect(provider.restoreSession(expired))
      .rejects.toMatchObject({ code: 'EXPIRED_SESSION' })
    expect(api.getAuthorizedUser).not.toHaveBeenCalled()
  })

  it('clears rejected provider credentials and emits a secret-safe error', async () => {
    const api = taxiApi()
    vi.mocked(api.getAuthorizedUser).mockRejectedValue(
      new TaxiApiError('backend leaked secret-token', 'unauthorized'),
    )
    const vault = new MemoryTaxiSessionVault(() => 'rejected')
    const provider = new TaxiIdentityProvider(api, vault)
    const reference = vault.create(tokens)
    const failure = provider.restoreSession(reference)
    await expect(failure).rejects.toMatchObject({
      code: 'INVALID_PROVIDER_CREDENTIALS', message: 'Provider session is invalid',
    })
    expect(vault.read(reference)).toBeNull()
  })

  it('clears credentials and sanitizes an unexpected restore failure', async () => {
    const api = taxiApi()
    vi.mocked(api.getAuthorizedUser).mockRejectedValue(new Error('secret-token'))
    const vault = new MemoryTaxiSessionVault(() => 'failed')
    const provider = new TaxiIdentityProvider(api, vault)
    const reference = vault.create(tokens)
    await expect(provider.restoreSession(reference)).rejects.toMatchObject({
      code: 'RESTORE_FAILED', message: 'Session restore failed',
    })
    expect(vault.read(reference)).toBeNull()
  })

  it('deletes provider credentials even when remote logout fails', async () => {
    const api = taxiApi()
    vi.mocked(api.logout).mockRejectedValue(new Error('secret-token'))
    const vault = new MemoryTaxiSessionVault(() => 'logout')
    const provider = new TaxiIdentityProvider(api, vault)
    const session = await provider.login({
      identifier: 'u@example.com', secret: 'secret', kind: 'email',
    })
    await expect(provider.logout(session)).rejects.toMatchObject({
      code: 'LOGOUT_FAILED', message: 'Session logout failed',
    })
    expect(vault.read(session.reference)).toBeNull()
  })

  it('restores the authenticated Store after login and a full application recreation', async () => {
    const api = taxiApi()
    const storage = new BrowserStorage()
    const first = createPersistentStore(api, storage, () => 'f5')

    const session = await first.login({
      identifier: 'u@example.com', secret: 'secret', kind: 'email',
    })
    expect(storage.getItem('platform-identity.session-reference')).toBe(session.reference)
    expect(storage.getItem(taxiStorageKey(session.reference))).toContain(tokens.token)

    const recreated = createPersistentStore(api, storage)
    await recreated.initialize()
    expect(recreated.getSnapshot()).toMatchObject({
      status: 'authenticated', identity: { id: '1' }, sessionError: null,
    })
    expect(api.getAuthorizedUser).toHaveBeenCalledWith(tokens)
  })

  it('prevents restore after logout and clears both storage boundaries', async () => {
    const api = taxiApi()
    const storage = new BrowserStorage()
    const store = createPersistentStore(api, storage, () => 'logout-f5')
    const session = await store.login({
      identifier: 'u@example.com', secret: 'secret', kind: 'email',
    })

    await store.logout()
    expect(storage.getItem('platform-identity.session-reference')).toBeNull()
    expect(storage.getItem(taxiStorageKey(session.reference))).toBeNull()

    const recreated = createPersistentStore(api, storage)
    await recreated.initialize()
    expect(recreated.getSnapshot()).toMatchObject({
      status: 'idle', identity: null, session: null, sessionError: 'NO_SESSION',
    })
  })

  it('clears persistent credentials even when backend logout fails', async () => {
    const api = taxiApi()
    vi.mocked(api.logout).mockRejectedValue(new Error('secret-token'))
    const storage = new BrowserStorage()
    const store = createPersistentStore(api, storage, () => 'failed-logout-f5')
    const session = await store.login({
      identifier: 'u@example.com', secret: 'secret', kind: 'email',
    })

    await expect(store.logout()).rejects.toMatchObject({ code: 'LOGOUT_FAILED' })
    expect(storage.getItem('platform-identity.session-reference')).toBeNull()
    expect(storage.getItem(taxiStorageKey(session.reference))).toBeNull()
  })

  it.each([
    ['rejected', new TaxiApiError('backend leaked secret-token', 'unauthorized'),
      'INVALID_PROVIDER_CREDENTIALS'],
    ['unexpected', new Error('backend leaked secret-token'), 'RESTORE_FAILED'],
  ] as const)('cleans up a %s persistent restore failure', async (_, failure, code) => {
    const api = taxiApi()
    const storage = new BrowserStorage()
    const first = createPersistentStore(api, storage, () => `restore-${code}`)
    const session = await first.login({
      identifier: 'u@example.com', secret: 'secret', kind: 'email',
    })
    vi.mocked(api.getAuthorizedUser).mockRejectedValue(failure)

    const recreated = createPersistentStore(api, storage)
    await recreated.initialize()
    expect(recreated.getSnapshot()).toMatchObject({
      status: 'idle', identity: null, session: null, sessionError: code,
    })
    expect(storage.getItem('platform-identity.session-reference')).toBeNull()
    expect(storage.getItem(taxiStorageKey(session.reference))).toBeNull()
    expect(JSON.stringify(recreated.getSnapshot())).not.toContain(tokens.token)
    expect(recreated.getSnapshot().error).not.toContain(tokens.token)
  })

  it('keeps credentials out of Core state, opaque handles, URLs and logs', async () => {
    const api = taxiApi()
    const storage = new BrowserStorage()
    const store = createPersistentStore(api, storage, () => 'no-leak')
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const session = await store.login({
      identifier: 'u@example.com', secret: 'secret', kind: 'email',
    })
    const observable = [
      session.reference,
      JSON.stringify(store.getSnapshot()),
      storage.getItem('platform-identity.session-reference') ?? '',
      new URL(`/session/${session.reference}`, 'https://example.test').href,
    ].join('\n')
    expect(observable).not.toContain(tokens.token)
    expect(observable).not.toContain(tokens.u_hash)
    expect(log).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    log.mockRestore()
    error.mockRestore()
  })
})

function createPersistentStore(
  api: TaxiApi,
  storage: BrowserStorage,
  createId?: () => string,
) {
  const provider = new TaxiIdentityProvider(
    api,
    new PersistentTaxiSessionVault(storage, createId),
  )
  return new IdentityStore(
    new IdentityService(provider),
    new PersistentSessionStorage(storage),
  )
}

function taxiStorageKey(reference: SessionReference): string {
  return `taxi.identity.temporary-wa.session:${reference}`
}

class BrowserStorage implements TaxiCredentialStorage {
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
}
