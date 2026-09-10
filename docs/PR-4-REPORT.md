# PR-4 Identity capability boundaries and provider contract audit

## Result

The Identity contract can now represent providers that do not support every
operation. Capability discovery is provider-neutral and deterministic, unsupported
operations stop in `IdentityService` without calling a provider, and provider
failures are exposed through a small secret-safe taxonomy. No Taxi business field,
endpoint, role name or transport error was added to Identity Core.

## IdentityProvider operation audit

| Operation | Universal boundary | Input | Output | Capability | Provider-specific boundary / error |
| --- | --- | --- | --- | --- | --- |
| `login` | Authenticate universal credentials | `Credentials` | `Session` with `Identity` | `AUTHENTICATION` | Provider maps known credential failures to `AUTHENTICATION_FAILED`; unknown transport/operation failures stay distinct |
| `register` | Create identity from universal profile | `RegistrationRequest` or typed provider extension | `RegistrationResult` | `REGISTRATION` | Taxi onboarding fields remain in `TaxiRegistrationRequest`; unknown failures become `PROVIDER_OPERATION_FAILED` |
| `restoreSession` | Restore from opaque reference | `SessionReference` | `Session \| null` | `SESSION_RESTORE` | Provider owns credentials; PR-3 session errors remain provider-neutral |
| `logout` | End current session | `Session \| null` | `void` | `LOGOUT` | Provider owns remote logout and credentials; PR-3 cleanup remains intact |
| `updateProfile` | Change universal attributes | `Identity`, `ProfileUpdate`, `Session` | `Identity` | `PROFILE_UPDATE` | Taxi car/documents remain in typed Taxi extension; failures are normalized |
| `remindPassword` | Start provider recovery | universal identifier | `void` | `PASSWORD_RECOVERY` | Provider adapts its actual recovery flow; absence is explicit, never fake success |

`PROFILE_READ` is a data capability in the current contract: a complete
`IdentityProfile` is returned with identity during login/registration/restore and
Taxi can retrieve the authorized user. No redundant standalone read method was
added. `ACL` declares that identity results contain the provider's authoritative
ACL facts; it does not mean the frontend enforces authorization.

All operation methods are optional at the provider boundary. A provider declares
its supported static capability list; `IdentityService` checks both the declaration
and matching function before invocation. A declared capability with a missing
function is a provider contract failure, not an unsupported result.

## Capability model

The provider-neutral capabilities are:

`AUTHENTICATION`, `REGISTRATION`, `SESSION_RESTORE`, `PROFILE_READ`,
`PROFILE_UPDATE`, `PASSWORD_RECOVERY`, `LOGOUT`, and `ACL`.

`IdentityService.capabilities()` returns a deduplicated snapshot captured when the
service is created. Discovery therefore requires no backend call and cannot change
mid-session. `hasCapability()` is available through both service and store.

## Capability is not permission

| Concept | Owner | Question | Example |
| --- | --- | --- | --- |
| Capability | Provider implementation | Can this provider perform the operation? | `PASSWORD_RECOVERY` |
| Permission | Current identity authorization state | May this identity perform an action? | `profile.update` |

Capability discovery is feature availability only. It is not an authorization or
security boundary. Likewise, client-side `hasPermission()` remains a UI hint; the
backend must authorize protected operations.

## Unsupported behavior

When a capability is absent, `IdentityService` throws
`IdentityOperationError('UNSUPPORTED_CAPABILITY')` before invoking the provider.
It does not fall back to another provider and does not simulate success.

`FakeIdentityProvider` declares the full current set.
`LimitedFakeIdentityProvider` omits `PASSWORD_RECOVERY`; tests spy on the inherited
operation and prove it is never called. The optional contract is also tested with a
minimal provider object that has no recovery method at all.

## Error taxonomy

| Category | Public representation |
| --- | --- |
| Unsupported capability | `IdentityOperationError: UNSUPPORTED_CAPABILITY` |
| Authentication failure | `IdentityOperationError: AUTHENTICATION_FAILED` |
| Authorization failure | `IdentityOperationError: AUTHORIZATION_FAILED` |
| Validation failure | `IdentityOperationError: VALIDATION_FAILED` |
| Other provider operation failure | `IdentityOperationError: PROVIDER_OPERATION_FAILED` |
| Session lifecycle failure | PR-3 `IdentitySessionError` codes |

Known Taxi credential, input and authorization errors are mapped in the adapter.
Explicit provider-neutral errors pass through the service. Unknown provider errors
are replaced with a fixed message and no original cause/details, so Taxi transport
payloads, credential material and internal error types do not leak into Core API.

## Taxi capability mapping and evidence

| Identity operation | Universal | Capability | Taxi support | Evidence |
| --- | --- | --- | --- | --- |
| Login | Yes | `AUTHENTICATION` | Confirmed | `TaxiApi.login`; existing `/auth` to `/token` client flow |
| Register | Yes | `REGISTRATION` | Confirmed | `TaxiApi.register`; Taxi-specific onboarding stays in adapter extension |
| Restore | Yes | `SESSION_RESTORE` | Confirmed | `TaxiApi.getAuthorizedUser` plus PR-3 vault/reference flow |
| Profile read | Yes | `PROFILE_READ` | Confirmed | Authorized user/profile returned by login, registration and restore |
| Profile update | Yes | `PROFILE_UPDATE` | Confirmed | `TaxiApi.updateProfile` and explicit Taxi mapping |
| Password recovery | Yes | `PASSWORD_RECOVERY` | Confirmed | `TaxiApi.remindPassword` |
| Logout | Yes | `LOGOUT` | Confirmed | `TaxiApi.logout` plus guaranteed local vault cleanup |
| ACL | Yes | `ACL` | Confirmed with GAP | `u_role` is mapped; API still provides no permissions/capability claims |

The declaration lives in `TaxiIdentityProvider`, next to the implementation and
evidence boundary. Identity Core contains only universal capability names.

## Profile and registration boundaries

`IdentityProfile` remains limited to common identity attributes: name parts,
email, phone, photo, city and language. No Taxi car, driver, document, referral,
upload or onboarding field was added. Taxi fields such as birthday, currency,
driver GPS software and free-form details remain outside Core; their universality
is unproven and they are candidates/GAPs rather than automatic Core additions.

Universal registration still contains only credentials and profile data. Taxi
role, referral code, driver car, documents/uploads, country defaults and onboarding
details remain in the typed `TaxiRegistrationData` extension handled by the Taxi
adapter. The Taxi backend contract is unchanged.

## Confirmed facts and GAPs

Confirmed:

- every capability declared by Taxi corresponds to an existing `TaxiApi` behavior;
- capabilities are static implementation metadata and require no network discovery;
- Fake and limited providers work without importing Taxi;
- PR-2 ACL and PR-3 session models remain unchanged.

GAPs:

- Taxi ACL still has authoritative role data but no permission list or capability
  claims; `permissions: []` remains the correct mapping;
- production-safe reload restore still needs the PR-3 backend HttpOnly session
  contract;
- no evidence was supplied for Google, WhatsApp, OAuth, MFA, referrals, KYC,
  organizations, memberships or a cross-provider fallback policy.

## Architecture boundary

Identity Core owns universal capability types, discovery, checks and safe errors.
Provider implementations own their declarations, mappings, transport and optional
extensions. Capability is never stored on `Identity`; Permission is never used to
infer provider support. No registry, DI framework, policy engine or automatic
provider fallback was introduced.

## Verification

- full and limited Fake Provider discovery;
- unsupported recovery does not invoke the provider;
- a provider may omit an unsupported method entirely;
- unknown provider errors are sanitized and explicit authorization errors survive;
- Taxi declares the eight behaviors confirmed by its API;
- architecture tests enforce capability/permission separation, provider-neutral
  names, Taxi isolation and universal error types;
- all PR-1 through PR-3 regressions and production build are recorded below.

### Execution

- `npm test`: 11 files, 60 tests passed.
- `npm run build`: TypeScript and Vite production build passed.
