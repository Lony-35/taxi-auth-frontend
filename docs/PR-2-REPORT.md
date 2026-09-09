# PR-2 Identity ACL acceptance report

## Responsibility boundary

| Layer | Responsibility |
| --- | --- |
| Identity Core | Universal identity, role and permission model; ACL lookup helpers |
| IdentityProvider | Returns complete provider-neutral Identity/ACL with login and restore |
| Taxi Provider | Maps confirmed Taxi access data to universal roles/permissions |
| Taxi API | Source of Taxi authorization data |
| Backend | Actual authorization and security enforcement |

Client-side `hasRole` and `hasPermission` checks are UI/UX hints. They never replace
backend authorization.

## ACL model

`Identity.roles` is a list of provider-neutral role identifiers.
`Identity.permissions` is a list of provider-neutral capability identifiers.
No `Membership`, `Organization`, `Team` or `Tenant` entity was added because the
current Taxi backend/API contract contains no contextual membership evidence.

ACL is returned as part of `Identity` on login, registration, restore and profile
update. It is not fetched through a Taxi-specific call from Identity Core.

## Taxi mapping and confirmed facts

The mapping is isolated in `src/providers/taxi/mapping.ts`:

| Confirmed Taxi role | Universal role |
| --- | --- |
| `Client` | `client` |
| `Driver` | `driver` |
| `Administrator` | `administrator` |
| `Agent` | `agent` |

Confirmed authorization facts:

- `TaxiUser` contains one `u_role` value represented by the four-value `UserRole` enum.
- Login and restore both return a `TaxiUser`, so the role can be mapped in both flows.
- The supplied Taxi API contract exposes no permission collection, capability claims,
  role-to-permission policy or permissions endpoint.

## GAP

Taxi permissions cannot be recovered truthfully from the supplied API. The adapter
therefore returns `permissions: []` for Taxi identities. It does not infer capabilities
from role names. A backend field or endpoint containing authoritative capabilities is
required before Taxi permissions can be populated.

`FakeIdentityProvider` supplies roles and permissions independently for Core tests.

## Verification

- Full test suite: `npm test` — 9 files, 35 tests passed.
- Production build: `npm run build` — passed.
- Boundary tests verify no Taxi imports, DTOs, endpoint names or access fields leak
  into `src/identity/**`, and that Taxi mapping remains in the provider adapter.
- Tests cover Fake Provider login/restore, role and permission checks, Taxi role
  mapping, the explicit empty-permission GAP and existing PR-1 behavior.
