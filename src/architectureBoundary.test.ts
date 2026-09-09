import { describe, expect, it } from 'vitest'
import contract from './identity/contract/IdentityProvider.ts?raw'
import model from './identity/model/identity.ts?raw'
import fakeProvider from './identity/provider/FakeIdentityProvider.ts?raw'
import service from './identity/service/IdentityService.ts?raw'
import store from './identity/store/IdentityStore.ts?raw'
import storage from './identity/store/SessionStorage.ts?raw'
import taxiProvider from './providers/taxi/TaxiIdentityProvider.ts?raw'
import taxiClient from './providers/taxi/httpClient.ts?raw'
import taxiMapping from './providers/taxi/mapping.ts?raw'
import taxiProfile from './providers/taxi/profile.ts?raw'
import taxiUserMapping from './providers/taxi/taxiUserMapping.ts?raw'

const coreSources = [contract, model, fakeProvider, service, store, storage]

describe('Identity Core dependency boundary', () => {
  it('contains no provider implementation imports or legacy transport fields', () => {
    const source = coreSources.join('\n')
    const forbidden = [
      'providers/taxi', 'u_' + 'id', 'u_' + 'role', 'u_' + 'details',
      'u_' + 'hash', 'auth_' + 'hash', "'/" + "auth'", "'/" + "token'",
      "'/" + "user'", "'/" + "car'", "'/" + "dropbox'",
    ]
    forbidden.forEach(value => expect(source).not.toContain(value))
  })

  it('keeps the universal ACL model free of Taxi role names and transport details', () => {
    const source = [contract, model, service, store, storage].join('\n')
    const forbidden = ['Client', 'Driver', 'Administrator', 'Agent', '/permissions', '/roles']
    forbidden.forEach(value => expect(source).not.toContain(value))
    expect(fakeProvider).not.toContain('providers/taxi')
  })

  it('keeps all Taxi ACL mapping in the Taxi adapter', () => {
    expect(taxiMapping).toContain('taxiRoleToRole')
    expect(taxiMapping).toContain('taxiUserToPermissions')
    expect(taxiMapping).toContain('user.u_role')
  })

  it('keeps the Taxi provider independent from the legacy auth facade', () => {
    const source = [taxiProvider, taxiClient, taxiMapping, taxiProfile, taxiUserMapping].join('\n')
    expect(source).not.toContain("../../auth")
    expect(source).not.toContain('AuthService')
    expect(source).not.toContain('JSON.parse(reference)')
    expect(source).not.toContain('JSON.stringify([tokens.token')
  })
})
