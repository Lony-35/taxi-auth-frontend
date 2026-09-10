# PR-3 production session persistence and security report

## Result

PR-3 adds durable storage for a provider-neutral opaque session reference,
provider-owned credential lifecycle handling, explicit secret-safe failure states,
and deterministic cleanup. It does not persist Taxi bearer credentials or claim
that browser storage provides production token security.

| Component | Stores | Knows Taxi |
| --- | --- | --- |
| Identity Core | Identity + opaque reference | No |
| SessionStorage | SessionReference | No |
| IdentityProvider | Provider-neutral contract | No |
| TaxiIdentityProvider | Taxi mapping | Yes |
| TaxiSessionVault | Taxi credentials | Yes |
| Backend | Authoritative session/security | Yes |

## Architecture audit

- `SessionReference` remains an opaque branded string. Core neither parses it nor
  embeds a bearer token, hash, DTO, JSON, base64 payload or JWT.
- `PersistentSessionStorage` is the single durable reference adapter. It works with
  `localStorage` and equivalent key/value stores, and stores only that reference.
- `MemorySessionStorage` remains useful for tests and nonpersistent consumers; it
  does not duplicate the storage interface.
- `IdentityService` and `IdentityStore` know only the `IdentityProvider` contract.
- `TaxiIdentityProvider` owns the Taxi login/restore/logout mapping.
- `TaxiSessionVault` is the only new-architecture component that stores Taxi
  credentials. Its memory implementation returns defensive copies, rejects
  duplicate references, expires entries and requires a cryptographically random ID
  source when no test generator is injected.

## Lifecycle behavior

| Condition | Result |
| --- | --- |
| No stored reference | idle, `NO_SESSION`; provider is not called |
| Unknown/stale reference | reference cleared, idle, `INVALID_REFERENCE` |
| Expired vault entry | credentials removed, reference cleared, `EXPIRED_SESSION` |
| Provider rejects credentials | credentials removed, reference cleared, `INVALID_PROVIDER_CREDENTIALS` |
| Unexpected restore failure | credentials/reference cleared, `RESTORE_FAILED` |
| Successful restore | authenticated identity/session, no session error |
| Logout succeeds | provider credentials removed, reference cleared, idle |
| Provider logout fails | provider credentials and reference still cleared; `LOGOUT_FAILED` is returned |

Public error messages are fixed provider-neutral strings. The original provider
error/cause is not attached, preventing tokens or backend payloads from leaking
through state or normal application error rendering.

## Threat model

| Threat/failure | Treatment and residual risk |
| --- | --- |
| XSS | Credentials are not added to browser persistence. XSS can still steal an opaque browser reference and act in the user's origin; CSP, output encoding and backend binding/revocation remain required. |
| Bearer-token theft | Taxi credentials remain in the provider vault, not Core or `localStorage`. In-memory JavaScript credentials remain reachable to successful same-origin script compromise. |
| Reference theft | Reference contains no secret material, but must still be treated as sensitive if the backend makes it redeemable. Backend must bind, expire and revoke it. |
| Page reload / process restart | Opaque reference survives. Current in-memory Taxi credentials do not; restore returns a typed invalid-reference result and clears stale state. This is the documented backend GAP below. |
| Expired or stale state | Vault distinguishes missing and expired; store clears the durable reference and returns to idle. |
| Duplicate references | Vault refuses insertion and never overwrites another credential set. |
| Serialization leakage | Reference storage writes the string unchanged; no credentials, JSON, base64 or JWT are produced by Core. |
| Logout network failure | Provider cleanup runs in `finally`; Core reference clearing also runs in `finally`, and a safe typed failure is returned. |

## Confirmed Taxi GAP

The supplied Taxi API authenticates frontend requests with provider bearer values
(`token` and `u_hash`). It does not expose a backend-owned browser session,
credential-free restore call, reference exchange, or refresh/revocation contract.
Therefore this frontend cannot both survive a full reload and keep those bearer
credentials out of JavaScript-readable persistent storage. Putting them in
`localStorage`, IndexedDB or an encoded/JWT-shaped reference would only disguise
the same security problem and is intentionally not implemented.

Minimum backend contract required for production persistence:

1. Login establishes a server-side session using a `Secure`, `HttpOnly`,
   appropriately scoped `SameSite` cookie; JavaScript does not receive reusable
   bearer credentials.
2. A credential-free restore/current-identity endpoint validates the cookie and
   returns the current identity/ACL, with explicit expiry/invalid responses.
3. Sessions have server-side expiry, rotation and revocation; replay and concurrent
   use policy are defined.
4. Logout is idempotent, revokes the server-side session and expires the cookie.
5. CSRF controls and CORS/origin policy are defined for state-changing requests.

With that contract, `TaxiSessionVault` can be replaced by a backend-session adapter
without changing Identity Core or the `SessionStorage` interface.

## Verification

- Persistent reference tests cover recreation/reload semantics, exact stored value
  and stale-reference cleanup.
- Store tests cover no session, invalid reference, expiry, unknown restore failure,
  secret-safe messages and logout failure cleanup.
- Vault tests cover isolation, defensive copies, expiry and duplicate references.
- Taxi provider tests cover invalid/expired/provider-rejected credentials,
  unexpected restore failures and failed logout cleanup.
- Architecture boundary tests assert Core persistence contains no Taxi knowledge or
  serialization and credential storage stays in the Taxi vault.
- Full suite and production build are recorded after execution below.

### Execution

- `npm test`: 10 files, 50 tests passed.
- `npm run build`: TypeScript and Vite production build passed.
