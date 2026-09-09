# PR-1 acceptance report

## Architecture tree

```text
src/identity/
  model/identity.ts
  contract/IdentityProvider.ts
  service/IdentityService.ts
  store/IdentityStore.ts
  store/SessionStorage.ts
  provider/FakeIdentityProvider.ts

src/providers/taxi/
  TaxiIdentityProvider.ts
  httpClient.ts
  mapping.ts
  formData.ts
  profile.ts
  taxiUserMapping.ts
```

Dependency flow:

```text
Consumer -> IdentityService/IdentityStore -> IdentityProvider contract
                                                ^
                                                |
                                    TaxiIdentityProvider or FakeIdentityProvider
```

## Mapping locations

`src/providers/taxi/mapping.ts` contains Taxi user, profile, status, auth/session
and reverse profile-update mappings. Taxi HTTP response normalization stays in
`src/providers/taxi/taxiUserMapping.ts`.

## Isolation

Identity Core contains no Taxi imports, endpoint names, Taxi DTO fields, car logic
or upload logic. These details are isolated under `src/providers/taxi`.

## Provider independence

`src/identity/store/IdentityStore.test.ts` runs login, restore, registration,
profile update and logout with `FakeIdentityProvider`, without a Taxi client.

## Regression

Before PR submission:

```text
npm test       29 tests passed
npm run build  passed
```

The original login/register/logout/restore/profile/password-recovery tests remain
in the suite alongside the new provider and mapping tests.
