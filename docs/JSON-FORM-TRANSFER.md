# JSON Form Engine transfer

## Transferred from Taxi

- `JSONForm`, `JSONFormElement`, the type model, calculation utilities, custom component registry and original SCSS component structure.
- Text, email, number, phone, password, hidden, select, checkbox, radio, file, button and submit fields.
- Expressions and variables, dynamic/dependent options, default values, Yup validation, multiple files, excluded submit values and flat/nested conversion.
- `form_register` and `form_profile` parsing from `window.data.site_constants`.
- Registration password/password-confirmation insertion before agreement or submit controls when absent from configuration.
- Profile field filtering for client and driver check states.

## Temporarily retained

- Driver registration fields, document tuples and car data remain mapped by the Auth UI to the existing Taxi Auth API.
- Client/driver profile allow-lists remain at the form-integration boundary.
- `window.data`, `site_constants` and `def_maska_tel` remain supported as the configuration contract.
- The existing login form remains because login is not a `form_register` or `form_profile` consumer.

## Adapters

- Taxi Redux configuration status is represented by `configReady`; the Auth frontend does not import the complete Taxi Redux tree.
- Taxi localization and language selectors are represented by small adapters which first read `window.data` and otherwise use standalone Russian defaults.
- Taxi Button and Alert dependencies use local accessible React controls while preserving JSON Form semantics.
- Deep-get, flatten and nesting helpers are colocated with the engine so the complete Taxi utility module is not pulled into Auth.

## Follow-up cleanup

- Extract localization/config adapters behind a consumer-supplied interface after parity is confirmed against production data.
- Move Taxi driver documents, cars and check-state filtering into a Taxi form-integration package without changing the JSON Form DSL.
- Remove standalone fallback schemas only when the embedding application always supplies production `site_constants`.

## Verification

- Dynamic form JSON parsing and password insertion.
- All expression operators and `@form` variable access.
- Field rendering, visibility, disabled submit, filtered options and nested submit.
- Required/email validation and multiple file change/removal behavior.
- Existing authentication, storage, identity and Taxi provider regressions.

Commands: `npm test`, `npm run build`.
