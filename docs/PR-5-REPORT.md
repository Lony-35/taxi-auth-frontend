# PR-5 Stable Identity Consumer contract

## Result

`src/identity` is now verified as the complete provider-neutral entry point for a
consumer. A consumer constructs `IdentityService` and `IdentityStore`, discovers
provider capabilities, runs the supported lifecycle, reads ACL hints and handles
normalized operation/session failures without importing Taxi. PR-1 through PR-4
semantics remain intact.

## Public Consumer API audit

| Public export | Contract purpose |
| --- | --- |
| `IdentityProvider<TRegistration, TProfileUpdate>` | Provider boundary implemented by adapters |
| `IdentityService<TRegistration, TProfileUpdate>` | Capability checks, operations, ACL helpers and error normalization |
| `IdentityStore<TRegistration, TProfileUpdate>` | Observable consumer lifecycle and opaque-reference persistence |
| `IdentityState`, `IdentityStoreStatus` | Stable store snapshot contract |
| `Identity`, `IdentityProfile`, `IdentityStatus`, `IdentityId` | Provider-neutral identity model |
| `Credentials`, `RegistrationRequest`, `RegistrationResult`, `ProfileUpdate` | Universal operation inputs/results |
| `Session`, `SessionReference` | Session result and opaque, credential-free reference |
| `Role`, `Permission` | ACL facts and consumer helpers; not backend authorization |
| `IdentityCapability`, `identityCapabilities`, `fullIdentityCapabilities` | Capability vocabulary and provider declarations |
| `IdentityOperationError`, `IdentityOperationErrorCode` | Provider-neutral operation failures |
| `IdentitySessionError`, `SessionErrorCode`, `toIdentitySessionError` | Session lifecycle failures and adapter normalization helper |
| `SessionStorage`, `KeyValueStorage`, `MemorySessionStorage`, `PersistentSessionStorage` | Opaque-reference storage boundary |
| `FakeIdentityProvider`, `LimitedFakeIdentityProvider` | Consumer examples and deterministic contract verification |

No Taxi provider, Taxi DTO, endpoint, credential, role enum, transport error or
business field is exported by `src/identity/index.ts`. Concrete providers remain
separate imports. Helper functions and implementation details not listed above
remain internal modules.

## Consumer usage

```ts
import {
  IdentityService,
  IdentityStore,
  PersistentSessionStorage,
  type IdentityProvider,
} from './identity'

const provider: IdentityProvider = obtainProvider()
const service = new IdentityService(provider)
const storage = new PersistentSessionStorage(localStorage)
const store = new IdentityStore(service, storage)

await store.initialize()
if (store.hasCapability('PASSWORD_RECOVERY')) {
  await store.remindPassword('user@example.com')
}
```

The consumer depends on the provider contract, never on provider internals.

## IdentityStore lifecycle state contract

| Scenario | Resulting status | Identity/session | Error field |
| --- | --- | --- | --- |
| Initial / no persisted reference | `idle` | cleared | `sessionError: NO_SESSION` |
| Login success | `authenticated` | populated and reference stored | cleared |
| Login failure | `error` | cleared | normalized `operationError` |
| Restore success | `authenticated` | populated | cleared |
| Restore returns no session / invalid reference | `idle` | cleared, reference cleared | `sessionError: INVALID_REFERENCE` |
| Expired restore | `idle` | cleared, reference cleared | `sessionError: EXPIRED_SESSION` |
| Invalid provider credentials | `idle` | cleared, reference cleared | `sessionError: INVALID_PROVIDER_CREDENTIALS` |
| Unexpected restore failure | `idle` | cleared, reference cleared | `sessionError: RESTORE_FAILED` |
| Logout success | `idle` | cleared | `sessionError: NO_SESSION` |
| Logout failure | `idle` | cleared locally regardless | `sessionError: LOGOUT_FAILED` |
| Registration success with session | `authenticated` | populated and reference stored | cleared |
| Registration success without session | `idle` | returned identity, no session; stale reference cleared | `sessionError: NO_SESSION` |
| Registration failure | `error` | cleared | normalized `operationError` |
| Profile update success | `authenticated` | identity and session identity updated | cleared |
| Profile update failure | `error` | prior identity/session retained for retry/logout | normalized `operationError` |
| Profile update without session | `error` | cleared | `AUTHORIZATION_FAILED` |
| Password recovery success | prior resting lifecycle (`idle`/`authenticated`) | unchanged | cleared |
| Password recovery failure/unsupported | `error` | unchanged | normalized `operationError` |

Every operation clears stale error categories when it starts. `sessionError` and
`operationError` are separate so consumers never infer a provider operation
failure from a session lifecycle state.

## Operation and error contract

| Operation condition | Public error |
| --- | --- |
| Provider does not declare the capability | `UNSUPPORTED_CAPABILITY` before provider invocation |
| Known invalid login credentials | `AUTHENTICATION_FAILED` |
| Identity may not perform the operation | `AUTHORIZATION_FAILED` |
| Provider-neutral input rejection | `VALIDATION_FAILED` |
| Unknown provider/transport failure | `PROVIDER_OPERATION_FAILED` |
| Restore/logout lifecycle failure | PR-3 `IdentitySessionError` taxonomy |

Already normalized `IdentityOperationError` and `IdentitySessionError` instances
pass through `IdentityService` unchanged. Unknown provider errors are replaced by
fixed safe messages without `cause`, response payloads, credentials or transport
details. `IdentityStore` records the normalized code and rethrows the same public
error category.

## Capability contract

Capability is static provider implementation metadata. `IdentityService` snapshots
and deduplicates the declaration at construction. Each `capabilities()` call returns
a frozen copy, so consumers cannot mutate the service state. Discovery performs no
backend call and does not change after login, registration, profile/ACL changes or
external mutation of the provider's original declaration. Permission remains an
identity authorization fact and is never used to infer provider support.

`LimitedFakeIdentityProvider` omits `PASSWORD_RECOVERY`. Consumer-level tests prove
that `store.remindPassword()` returns `UNSUPPORTED_CAPABILITY`, records an error
state and does not invoke the provider method or simulate success. No fallback is
attempted.

## Provider replacement verification

`src/identity/consumerContract.test.ts` imports only the public `src/identity`
entry point. The same consumer construction runs the complete Fake lifecycle and
the Limited Provider unsupported path:

```text
Consumer -> IdentityStore -> IdentityService -> IdentityProvider
                                             -> Fake / Limited Fake
```

There are no Taxi imports, DTOs, role names, endpoint names or transport errors in
that consumer test.

## Taxi regression

The Taxi suite still verifies login, registration, restore, logout, profile update,
password recovery, capability declaration, ACL mapping, invalid/expired references,
credential rejection, secret-safe failure mapping and provider-vault cleanup.
Taxi-specific registration/profile extensions remain in the adapter. No Taxi
mapping or backend contract was expanded.

## Architecture boundary

The enforced dependency direction is:

```text
Consumer -> Identity Core -> IdentityProvider contract <- provider implementation
```

Core contains no import or public export of `TaxiApi`, Taxi DTOs, endpoints,
credentials, Taxi role enum, Taxi registration/profile fields or transport errors.
The Taxi provider may import the Core contract; the reverse dependency is tested
and forbidden. No registry, DI framework, policy engine or fallback layer was
introduced.

## Confirmed GAPs

- Taxi exposes an authoritative role but no permission list/capability claims;
  `permissions: []` remains the only evidence-based mapping.
- Production-safe reload restore still requires the PR-3 backend-owned HttpOnly
  session contract. Browser persistence stores only the opaque reference.
- No evidence or concrete consumer was supplied for another real provider.

## Intentionally out of scope

Google, WhatsApp, OAuth, MFA, invitations/referrals, KYC, onboarding extraction,
organizations, memberships, teams/tenants, authorization policy/ACL administration,
backend and refresh-token changes, new providers, automatic fallback, UI redesign,
GreenMarket integration and Taxi business-logic extraction were not implemented.

## Verification

- Full Fake Provider consumer lifecycle.
- Limited Provider unsupported recovery with zero provider invocation.
- All requested login, registration, restore, logout and profile transitions.
- Capability determinism and runtime immutability.
- Operation/session error separation and secret-safe normalization.
- Taxi regression and one-way architecture tests.
- `npm test`: 12 files, 72 tests passed.
- `npm run build`: TypeScript and Vite production build passed.
