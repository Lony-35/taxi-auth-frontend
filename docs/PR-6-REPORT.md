# PR-6 Taxi F5 session workaround

## Result

The current Taxi backend requires `token` and `u_hash` to restore an authorized
user. The in-memory `TaxiSessionVault` intentionally kept those credentials out
of Identity Core, but a full browser reload destroyed them. PR-6 adds a
provider-owned persistent vault so the accepted public Consumer API can restore
the same Taxi session after F5.

`src/identity` is unchanged. `SessionReference` remains an opaque credential-free
handle, and the provider-neutral `PersistentSessionStorage` still stores only
that handle.

## Credential location

Credential-bearing state is stored only by
`src/providers/taxi/sessionVault.ts` in `PersistentTaxiSessionVault`. Browser
runtime defaults to the browser's key-value storage; tests inject an isolated
in-memory implementation of the same Taxi-owned storage surface.

Each entry is namespaced with:

```text
taxi.identity.temporary-wa.session:<opaque SessionReference>
```

The value is a versioned Taxi-only record containing the credentials required by
the existing backend and an optional expiry timestamp. The generic
`platform-identity.session-reference` entry contains only the opaque reference.

## Login -> persist -> F5 -> restore

1. `IdentityStore.login()` calls the normal provider-neutral service operation.
2. `TaxiIdentityProvider.login()` receives Taxi credentials from the backend.
3. `PersistentTaxiSessionVault.create()` stores credentials inside the Taxi
   boundary and returns a random opaque `SessionReference`.
4. `IdentityStore` persists only that reference.
5. After F5, new Store, Service and Provider instances are created.
6. `IdentityStore.initialize()` reads the opaque reference and invokes the
   existing `restoreSession()` contract.
7. The recreated Taxi vault resolves the Taxi-only persistent credentials.
8. Taxi backend validation succeeds and the Store becomes `authenticated`.

No Taxi branch or credential field was added to `IdentityService`,
`IdentityStore`, `Identity`, `IdentityState`, `Session`, or `SessionReference`.

## Cleanup behavior

- Successful logout deletes persistent Taxi credentials in the provider's
  `finally` block, then Store clears the opaque reference.
- Failed backend logout follows the same local cleanup path and reports the
  existing `LOGOUT_FAILED` session error.
- Backend rejection during restore deletes the Taxi entry and reports
  `INVALID_PROVIDER_CREDENTIALS`; Store clears its reference and becomes
  unauthenticated.
- Unexpected restore failure also deletes the Taxi entry and reports the
  sanitized `RESTORE_FAILED` error.
- Malformed or expired persistent entries are removed on resolution.
- A subsequent F5 cannot loop on known-invalid or logged-out session material.

## Security boundary

Automated tests verify that Taxi credentials do not appear in:

- `SessionReference`;
- `Identity`, `Session`, or `IdentityState` serialization;
- provider-neutral persistent storage;
- normalized error messages;
- constructed URLs;
- application logs;
- source or exports under `src/identity`.

The persistent record itself necessarily contains credential-bearing material
because the current backend offers no server-owned browser session. The record
is namespaced and accessed only through the Taxi provider boundary. This limits
architectural exposure but does not protect it from script execution in the
same browser origin.

## Temporary WA / Removal Condition

`PersistentTaxiSessionVault` is marked in code with:

```text
TEMPORARY WA — REMOVE AFTER BACKEND-OWNED SESSION
```

This is a security compromise, not an equivalent to a server-side session.
Browser storage is readable by JavaScript running on the same origin and is
therefore weaker than a Secure/HttpOnly cookie.

Remove the workaround after Taxi backend provides a server-owned session with:

- Secure/HttpOnly/SameSite cookie handling;
- backend validation and expiry;
- logout invalidation;
- a restore endpoint that does not require frontend-held bearer credentials.

At that point remove `PersistentTaxiSessionVault` and
`createDefaultTaxiSessionVault`, and restore the provider default to an
in-memory/backend-session implementation. Consumer API, Identity Core, Store,
Service, and `SessionReference` do not need to change.

## Changed files

- `src/providers/taxi/sessionVault.ts`
- `src/providers/taxi/sessionVault.test.ts`
- `src/providers/taxi/TaxiIdentityProvider.ts`
- `src/providers/taxi/TaxiIdentityProvider.test.ts`
- `src/providers/taxi/index.ts`
- `src/architectureBoundary.test.ts`
- `README.md`
- `docs/PR-6-REPORT.md`

## Verification coverage

- login -> persist -> recreate provider/store -> restore -> authenticated;
- login -> logout -> recreate provider/store -> no restore;
- logout backend failure -> local credential and reference cleanup;
- rejected persistent restore -> cleanup and unauthenticated state;
- unexpected restore failure -> cleanup and sanitized error;
- malformed and expired entry cleanup;
- defensive credential copies;
- no credential leakage through Core state, handles, errors, URLs, or logs;
- architectural check that the WA marker and persistence stay Taxi-only;
- all previous login, registration, profile, recovery, ACL, capability, session
  taxonomy and Consumer API tests.

No Taxi backend or API change is required.
