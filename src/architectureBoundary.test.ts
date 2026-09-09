import { describe, expect, it } from 'vitest'
import contract from './identity/contract/IdentityProvider.ts?raw'
import model from './identity/model/identity.ts?raw'
import fakeProvider from './identity/provider/FakeIdentityProvider.ts?raw'
import service from './identity/service/IdentityService.ts?raw'
import store from './identity/store/IdentityStore.ts?raw'
import storage from './identity/store/SessionStorage.ts?raw'

describe('Identity Core dependency boundary', () => {
  it('contains no provider implementation imports or legacy transport fields', () => {
    const source = [contract, model, fakeProvider, service, store, storage].join('\n')
    const forbidden = [
      'providers/taxi', 'u_' + 'id', 'u_' + 'role', 'u_' + 'details',
      'u_' + 'hash', 'auth_' + 'hash', "'/" + "auth'", "'/" + "token'",
      "'/" + "user'", "'/" + "car'", "'/" + "dropbox'",
    ]
    forbidden.forEach(value => expect(source).not.toContain(value))
  })
})
