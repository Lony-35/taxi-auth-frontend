import { describe, expect, it } from 'vitest'
import contract from './identity/contract/IdentityProvider.ts?raw'
import model from './identity/model/identity.ts?raw'
import capability from './identity/model/capability.ts?raw'
import operationError from './identity/model/operationError.ts?raw'
import sessionError from './identity/model/sessionError.ts?raw'
import fakeProvider from './identity/provider/FakeIdentityProvider.ts?raw'
import service from './identity/service/IdentityService.ts?raw'
import store from './identity/store/IdentityStore.ts?raw'
import storage from './identity/store/SessionStorage.ts?raw'
import taxiProvider from './providers/taxi/TaxiIdentityProvider.ts?raw'
import taxiClient from './providers/taxi/httpClient.ts?raw'
import taxiMapping from './providers/taxi/mapping.ts?raw'
import taxiProfile from './providers/taxi/profile.ts?raw'
import taxiUserMapping from './providers/taxi/taxiUserMapping.ts?raw'
import taxiVault from './providers/taxi/sessionVault.ts?raw'
import publicApi from './identity/index.ts?raw'
import consumerContract from './identity/consumerContract.test.ts?raw'

const coreSources = [
  contract, model, capability, operationError, sessionError, fakeProvider, service, store, storage,
]

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
    const source = [taxiProvider, taxiClient, taxiMapping, taxiProfile, taxiUserMapping, taxiVault].join('\n')
    expect(source).not.toContain("../../auth")
    expect(source).not.toContain('AuthService')
    expect(source).not.toContain('JSON.parse(reference)')
    expect(source).not.toContain('JSON.stringify([tokens.token')
  })

  it('keeps persistence provider-neutral and credentials inside the Taxi vault', () => {
    expect(storage).toContain('SessionReference')
    expect(storage).not.toContain('Taxi')
    expect(storage).not.toContain('JSON.stringify')
    expect(storage).not.toContain('btoa')
    expect(taxiVault).toContain('TaxiTokens')
    expect(taxiVault).toContain('sessions')
  })

  it('keeps capabilities provider-neutral and separate from identity permissions', () => {
    const forbidden = ['TAXI', 'DRIVER', 'CLIENT', 'REFERRAL', 'CAR', 'DOCUMENT_UPLOAD']
    forbidden.forEach(value => expect(capability).not.toContain(`'${value}'`))
    expect(model).toContain('permissions: Permission[]')
    expect(capability).not.toContain('Permission[]')
    expect(contract).not.toContain('TaxiApiError')
    expect(operationError).not.toContain('TaxiApiError')
  })

  it('keeps Taxi capability evidence in the Taxi adapter', () => {
    expect(taxiProvider).toContain('TAXI_IDENTITY_CAPABILITIES')
    expect(service).toContain('UNSUPPORTED_CAPABILITY')
    expect(service).not.toContain('providers/taxi')
  })

  it('exposes a provider-neutral public API and consumer example', () => {
    const forbidden = [
      'providers/taxi', 'TaxiApi', 'TaxiApiError', 'TaxiRegistration',
      'UserRole', 'u_' + 'role', '/auth', '/token', 'secret-token',
    ]
    forbidden.forEach(value => expect(publicApi).not.toContain(value))
    forbidden.slice(0, 8).forEach(value => expect(consumerContract).not.toContain(value))
    ;[
      'IdentityProvider', 'IdentityService', 'IdentityStore', 'IdentityState',
      'IdentityCapability', 'IdentityOperationError', 'IdentitySessionError',
      'SessionStorage', 'Role', 'Permission',
    ].forEach(value => expect(publicApi).toContain(value))
  })
})
