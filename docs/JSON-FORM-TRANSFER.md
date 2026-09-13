# JSON Form Engine transfer

## Scope

This stage restores the reusable JSON Form Engine and connects it to the Taxi
registration/profile screens. It is **not** presented as completion of the wider
Universal Auth API migration.

## Generic engine

- `JSONForm`, `JSONFormElement`, the field type model, expressions,
  calculations, `@form` variables, dependent options and custom components.
- Yup validation, visibility/disabled calculations, multiple file fields and
  deterministic flat/nested conversion.
- Only schema-declared values are submitted. A parent object such as
  `u_details` is merged with `u_details.*` children without losing either side.
- Host data, translation, language and phone-mask dependencies are injected
  through `JSONFormAdapter`; the engine no longer reads Taxi `window.data`.

## Taxi integration boundary

- `src/forms/config.ts` is the Taxi host bridge. It reads
  `window.data.site_constants.form_register/form_profile`, supplies localization,
  dynamic option data and `def_maska_tel`, and owns the fallback Taxi schemas.
- `ProfileEditor` renders every field supplied by `form_profile`; it no longer
  removes dynamic fields with a UI-level role/check-state allow-list.
- The Taxi provider receives schema field paths and permits their top-level
  values while excluding provider-managed identity, document and car fields.
  Legacy allow-lists remain only as a compatibility fallback for callers that
  do not provide a schema.
- Driver document tuples, car editing, referral validation and phone
  normalization remain inside Taxi integration/provider code.

## Referral and promo

- `ref_code` is a referral code and is the only value checked by the referral
  endpoint.
- `promo_code` is an independent value.
- Both values may be present and are sent to the Taxi registration API together.
- Fallback registration/profile labels no longer call `ref_code` a promo code.

## Regression evidence

`src/forms/taxiSiteConstants.fixture.ts` stores production-shaped
`site_constants` snapshots based on the Taxi repository's
`RegisterJSON.tsx`, `ProfileModal.tsx` and `json-form.md` contracts. The tests
load them through the same `readConfiguredFields()` path as the application and
cover:

- `form_register` and `form_profile` parsing;
- expressions/calculations, `@form`, dependent options and visible/disabled;
- validation and automatic `password/password_confirm` insertion;
- simultaneous `ref_code` and `promo_code` submit;
- dynamic profile attributes and conflict-free `u_details` nested submit;
- schema-based Taxi API filtering;
- multiple files and custom component compatibility.

ESLint now contains substantive correctness rules instead of an empty rule set.

## Verification

```text
npm run typecheck  passed
npm run lint       passed (zero warnings)
npm test           14 files, 84 tests passed
npm run build      passed
```
