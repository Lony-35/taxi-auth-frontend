# Platform Identity frontend

Reusable React + TypeScript identity foundation extracted from the Taxi application.
The repository keeps the existing Taxi authentication, registration, password recovery,
session restore, logout and profile-editing behavior while placing it behind a
provider-neutral Identity API.

Google, WhatsApp, ACL, invitations and a production token-security redesign are not
part of PR-1.

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
- `src/identity/store` — state and opaque session-reference storage; it contains no
  Taxi endpoint or DTO knowledge.
- `src/identity/provider` — `FakeIdentityProvider`, proving that the core can run
  without Taxi.
- `src/providers/taxi` — the only implementation layer that knows Taxi endpoints,
  two-step `/auth` -> `/token` login, DTO fields, driver registration, uploads,
  cars and profile rules.

Taxi is the current production provider, but Identity Core does not depend on it.
The old `src/auth` exports remain as a compatibility facade for the extracted demo;
new consumers should import the core from `src/identity` and the Taxi adapter from
`src/providers/taxi`.

Dependency direction is one-way: the core defines the contract; providers implement
it. Identity Core never imports Taxi modules.

## Public Identity API

```ts
import {
  IdentityService,
  IdentityStore,
  MemorySessionStorage,
} from './identity'
import {
  createAuthClient,
  TaxiIdentityProvider,
} from './providers/taxi'

const taxiApi = createAuthClient({ baseUrl: 'https://host.example/api/v1' })
const provider = new TaxiIdentityProvider(taxiApi)
const service = new IdentityService(provider)
const store = new IdentityStore(service, new MemorySessionStorage())

await store.login({
  identifier: 'user@example.com',
  secret: 'password',
  kind: 'email',
})
```

Replacing Taxi with `FakeIdentityProvider` requires no change to `IdentityService`
or `IdentityStore`.

## Taxi mappings

All mappings are explicit and live in `src/providers/taxi/mapping.ts`:

- `taxiUserToIdentity`: Taxi user -> `Identity`;
- `taxiProfileToIdentityProfile`: Taxi profile -> `IdentityProfile`;
- `taxiStatusToIdentityStatus`: Taxi status -> `IdentityStatus`;
- `taxiAuthToSession`: Taxi auth response -> `Session`;
- `identityProfileToTaxiValues`: universal profile changes -> Taxi update values.

Taxi fields such as `u_id`, `u_role`, `u_details`, `u_hash` and `auth_hash` do not
exist in the universal model. The session reference is opaque to Identity Core and
is encoded/decoded only by the Taxi adapter. The final production storage security
strategy is intentionally deferred to PR-3.

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
