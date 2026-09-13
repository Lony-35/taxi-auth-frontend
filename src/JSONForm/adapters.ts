export type Language = { iso: string }

/** Host-provided dependencies. The form engine itself has no Taxi globals. */
export interface JSONFormAdapter {
  data: Record<string, unknown>
  language: Language
  translate: (value: string) => string
  phoneMask: () => string
}

export const defaultJSONFormAdapter: JSONFormAdapter = {
  data: {},
  language: { iso: 'en' },
  translate: value => value,
  phoneMask: () => '',
}
