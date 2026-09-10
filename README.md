# Platform Identity frontend

Reusable React + TypeScript identity foundation extracted from the Taxi application.
The repository keeps the existing Taxi authentication, registration, password recovery,
session restore, logout and profile-editing behavior while placing it behind a
provider-neutral Identity API.

Google, WhatsApp and invitations remain out of scope. PR-3 adds durable opaque
session-reference storage, explicit lifecycle failures and a documented provider
credential boundary. The current Taxi backend still needs the contract described
below before credentials can be restored securely after a full page reload.

## Requirements and commands

Node.js 20+ is used by the current Vite toolchain.

```bash
cp .env.example .env
npm install
npm test
npm run build
npm run dev
```

Demo credentials in mock mode: `demo@example.com` / `demo`.

## Architecture

```text
Consumer / UI
      |
      v
Identity Core (model, service, store)
      |
      v
IdentityProvider contract
      |
      +---------------------+
      |                     |
      v                     v
TaxiIdentityProvider    FakeIdentityProvider
      |
      v
Taxi HTTP client -> Taxi backend
```

- `src/identity/model` — provider-neutral `Identity`, `IdentityProfile`,
  `IdentityStatus`, `Credentials` and `Session`.
- `src/identity/contract` — the formal `IdentityProvider` interface.
- `src/identity/service` — provider-neutral use-case facade.
- `src/identity/store` — state and opaque handle storage; it contains no Taxi
  credentials, endpoint or DTO knowledge.
- `src/identity/provider` — `FakeIdentityProvider`, proving that the core can run
  without Taxi.
- `src/providers/taxi` — the only implementation layer that knows Taxi endpoints,
  two-step `/auth` -> `/token` login, DTO fields, driver registration, uploads,
  cars and profile rules.

Taxi is the current production provider, but Identity Core does not depend on it.
The old `src/auth` surface remains only as a legacy compatibility boundary for the
extracted demo/UI. It does not export the new Identity API and is not an integration
entry point. New consumers must import the core from `src/identity` and a provider
from `src/providers/*`.

Dependency direction is one-way: the core defines the contract; providers implement
it. Identity Core never imports Taxi modules.

## Public Identity API

```ts
import {
  IdentityService,
  IdentityStore,
  PersistentSessionStorage,
} from './identity'
import {
  createAuthClient,
  TaxiIdentityProvider,
} from './providers/taxi'

const taxiApi = createAuthClient({ baseUrl: 'https://host.example/api/v1' })
const provider = new TaxiIdentityProvider(taxiApi)
const service = new IdentityService(provider)
const store = new IdentityStore(service, new PersistentSessionStorage(window.localStorage))

await store.login({
  identifier: 'user@example.com',
  secret: 'password',
  kind: 'email',
})
```

Replacing Taxi with `FakeIdentityProvider` requires no change to `IdentityService`
or `IdentityStore`.

## Provider capabilities

A capability describes what a provider implementation supports; a permission
describes what the current identity is allowed to do. They are separate types and
must not be used interchangeably. Consumers can discover support before rendering
or invoking an operation:

```ts
store.hasCapability('PASSWORD_RECOVERY')
store.hasPermission('profile.update')
```

`IdentityProvider.capabilities()` is a static provider declaration. Operations are
optional in the contract, so a limited provider does not implement fake success.
`IdentityService` rejects an absent capability with the secret-safe
`UNSUPPORTED_CAPABILITY` error before calling the provider. See
[`docs/PR-4-REPORT.md`](docs/PR-4-REPORT.md) for the complete contract audit and
Taxi evidence.

## Identity ACL

Every `Identity` contains complete `roles` and `permissions` arrays. A role groups
an identity under a provider-defined access category; a permission is a stable,
provider-neutral capability identifier such as `profile.update`. No organization,
team, tenant or membership model is introduced because the current Taxi contract
does not prove that such a context exists.

`IdentityProvider.login()` and `restoreSession()` return ACL together with the
identity. Consumers can use `IdentityStore.hasRole()` and
`IdentityStore.hasPermission()` (or the equivalent `IdentityService` methods)
without importing Taxi:

```ts
store.hasRole('driver')
store.hasPermission('profile.update')
```

These checks are UI/UX authorization hints only. The backend remains the security
boundary and must authorize every protected operation. Identity Core owns the
universal model and lookup helpers; each provider owns the mapping from its access
model. Domain business policy must not move into Identity Core without evidence
that it is shared identity policy.

## Taxi mappings

All mappings are explicit and live in `src/providers/taxi/mapping.ts`:

- `taxiUserToIdentity`: Taxi user -> `Identity`;
- `taxiProfileToIdentityProfile`: Taxi profile -> `IdentityProfile`;
- `taxiStatusToIdentityStatus`: Taxi status -> `IdentityStatus`;
- `taxiAuthToSession`: Taxi auth response -> `Session`;
- `identityProfileToTaxiValues`: universal profile changes -> Taxi update values.
- `taxiRoleToRole`: Taxi role enum -> provider-neutral role identifier;
- `taxiUserToPermissions`: confirmed Taxi authorization facts -> permissions.

Taxi fields such as `u_id`, `u_role`, `u_details`, `u_hash` and `auth_hash` do not
exist in the universal model. A `SessionReference` is only a random handle. Actual
Taxi credentials live in the provider-owned `TaxiSessionVault`; they are never
serialized into the universal reference. The default vault is deliberately
in-memory. Browser persistence contains only the opaque `SessionReference`; it
never contains Taxi bearer credentials.

## Session lifecycle and production security

`PersistentSessionStorage` accepts the browser `localStorage` API (or another
`KeyValueStorage`) and survives store/application recreation. It stores one opaque
reference and never parses or serializes credentials. `IdentityStore.sessionError`
distinguishes `NO_SESSION`, `INVALID_REFERENCE`, `EXPIRED_SESSION`,
`INVALID_PROVIDER_CREDENTIALS`, `RESTORE_FAILED` and `LOGOUT_FAILED`. Failed
restore clears stale local state. Logout clears provider credentials and then the
reference, even when the remote logout request fails.

An opaque reference is not an authorization boundary by itself. XSS can steal a
value stored in `localStorage`, and persisting the current Taxi bearer credentials
there would expose them directly. The supplied Taxi API has no secure browser
session mechanism, so `MemoryTaxiSessionVault` intentionally does not claim to
survive a page reload. Production reload restore requires a backend-owned session:
a Secure, HttpOnly, SameSite cookie (or an equivalent server-held session), a
credential-free restore endpoint, server-side expiry/revocation and idempotent
logout. See [`docs/PR-3-REPORT.md`](docs/PR-3-REPORT.md) for the full threat model,
GAP and minimum contract.

The confirmed Taxi authorization source currently exposes exactly one role in
`u_role` (`Client`, `Driver`, `Administrator` or `Agent`). The adapter maps it to
one universal role. The supplied Taxi user/API contract exposes no permission list,
capability claims or permission endpoint, so Taxi identities intentionally receive
`permissions: []`. Inventing permissions from a role would turn frontend policy
into an unsupported security claim; this is recorded as the PR-2 GAP.

## Registration and profile boundaries

Universal registration contains credentials and a profile. Driver documents, car
data, phone normalization and other Taxi-specific details are represented by the
explicit `TaxiRegistrationData` extension and are handled only by the adapter.

Universal profile updates use `IdentityProfile`. Existing Taxi document, car and
driver-specific changes are available through the explicit `TaxiProfileUpdate.taxi`
extension. No arbitrary Taxi DTO fields are hidden inside the Identity model.

## Taxi backend configuration

```env
VITE_AUTH_API_URL=https://host.example/taxi/c/default/api/v1
VITE_USE_MOCK_AUTH=false
VITE_DRIVER_PHONE_PREFIX=34
VITE_DEFAULT_COUNTRY=GHA
VITE_DEFAULT_LOCATION_CLASS_ID=5
```

The backend must allow the frontend origin through CORS.

## PR-1 verification

The test suite covers Identity/profile/status/session mappings, provider login,
registration, restore, logout, profile updates, `IdentityStore` with a Fake Provider,
and the existing Taxi HTTP/auth regression suite.

Run `npm test` and `npm run build`. The acceptance report is in
[`docs/PR-1-REPORT.md`](docs/PR-1-REPORT.md).

## PR-2 verification

The ACL acceptance report, confirmed Taxi facts and explicit GAP are in
[`docs/PR-2-REPORT.md`](docs/PR-2-REPORT.md).

## PR-3 verification

The persistence/security audit, lifecycle behavior, threat model and backend GAP
are in [`docs/PR-3-REPORT.md`](docs/PR-3-REPORT.md).

## PR-4 verification

The provider contract audit, capability/permission boundary, error taxonomy, Taxi
capability evidence and GAPs are in [`docs/PR-4-REPORT.md`](docs/PR-4-REPORT.md).

## Stable Consumer API

Consumers import the complete provider-neutral contract from `src/identity` and
construct `IdentityService` plus `IdentityStore`; they do not import a concrete
provider's internals. `IdentityState.operationError` exposes normalized operation
codes separately from PR-3 `sessionError`, and the Store now includes password
recovery alongside login, registration, restore, logout and profile update.

The public API audit, complete lifecycle table, Fake/Limited replacement proof,
Taxi regression and remaining GAPs are in
[`docs/PR-5-REPORT.md`](docs/PR-5-REPORT.md).

## Temporary Taxi F5 workaround

Until the Taxi backend provides a Secure/HttpOnly server-owned browser session,
`PersistentTaxiSessionVault` keeps the minimum restore credentials inside the
Taxi adapter boundary. Identity Core and provider-neutral storage continue to
see only an opaque `SessionReference`. Successful login survives a full browser
reload; logout and failed restore always remove the Taxi-specific persistent
entry.

This frontend persistence is a temporary security compromise and must be
removed after backend-owned session restore is available. The exact storage
boundary, threat trade-off, lifecycle evidence, removal condition, and test
coverage are documented in [`docs/PR-6-REPORT.md`](docs/PR-6-REPORT.md).
