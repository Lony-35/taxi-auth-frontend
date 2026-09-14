import { useCallback, useMemo, useState } from 'react'
import * as yup from 'yup'
import { defaultJSONFormAdapter, type JSONFormAdapter, type Language } from './adapters'
import CustomComponent from './components'
import JSONFormElement from './JSONFormElement'
import type { JSONFormState, TForm, TFormElement, TFormValues, TOptionData } from './types'
import { calculated, deepGet, isRequired, makeFlat, makeNested, optionData, parseVariable } from './utils'
import './styles.scss'

export interface JSONFormProps {
  fields: TForm
  onSubmit?: (values: Record<string, unknown>) => unknown
  onChange?: (fieldName: string, value: unknown) => unknown
  defaultValues?: Record<string, unknown>
  errors?: Record<string, unknown>
  state?: JSONFormState
  language?: Language
  configReady?: boolean
  adapter?: Partial<JSONFormAdapter>
}

function initialValues(fields: TForm, defaults: Record<string, unknown>, dataSource: unknown): TFormValues {
  const result = makeFlat(defaults)
  const reverseDefaults: TFormValues = {}

  for (const field of fields) {
    if (!field.name || Array.isArray(field.options) || !field.options || !('filter' in field.options)) continue
    const source = field.options as TOptionData
    if (!source.filter) continue
    const current = result[field.name] ?? field.defaultValue
    const map = deepGet(dataSource, source.path) as Record<string, Record<string, unknown>> | undefined
    const parent = current == null ? undefined : map?.[String(current)]
    const parentValue = parent?.[source.filter.field]
    if (parentValue != null) reverseDefaults[source.filter.by] = parentValue
  }

  for (const field of fields) {
    if (!field.name) continue
    let value = result[field.name] ?? deepGet(defaults, field.name) ?? reverseDefaults[field.name] ?? field.defaultValue ?? null
    if (value === null) {
      if (field.type === 'checkbox') value = false
      else if (['select', 'radio'].includes(String(field.type)) && isRequired(field)) value = optionData(field, result, {}, dataSource)[0]?.value ?? null
      else if (!field.type || ['text', 'email', 'phone', 'password', 'hidden'].includes(String(field.type))) value = ''
    }
    result[field.name] = value
  }
  return result
}

function prepareForm(fields: TForm, currentValues: TFormValues, dataSource: unknown): [TForm, TFormValues] {
  const form: TForm = []
  const values = { ...currentValues }
  for (const field of fields) {
    const type = calculated(field.type ?? 'text', values)
    const resolvedOptions = calculated(field.options as never, values)
    if ((type === 'select' || type === 'radio') && resolvedOptions && !Array.isArray(resolvedOptions) && typeof resolvedOptions === 'object' && 'path' in resolvedOptions) {
      const options = optionData({ ...field, options: resolvedOptions as TOptionData }, values, {}, dataSource)
      const source = resolvedOptions as TOptionData
      if (field.name && source.filter) {
        const fieldName = field.name
        const accepted = options.some(option => option.value == values[fieldName])
        if (!accepted) values[fieldName] = options[0]?.value ?? null
      }
      form.push({ ...field, options, disabled: options.length === 0 ? true : field.disabled })
    } else {
      form.push(field)
    }
  }
  return [form, values]
}

function validationFor(
  field: TFormElement,
  values: TFormValues,
  variables: Record<string, unknown>,
  adapter: JSONFormAdapter,
): yup.AnySchema {
  const type = calculated(field.type ?? 'text', values, variables) ?? 'text'
  const validation = field.validation ?? {}
  let schema: yup.AnySchema

  if (type === 'hidden') schema = yup.mixed()
  else if (type === 'file') schema = yup.array()
  else if (type === 'number') schema = yup.number().transform((value, original) => original === '' ? undefined : value)
  else if (type === 'checkbox') schema = yup.boolean()
  else if (type === 'select') schema = yup.string().nullable()
  else schema = yup.string()

  if (type === 'email' || calculated(validation.email ?? false, values, variables)) {
    schema = (schema as yup.StringSchema).email(adapter.translate('email_error'))
  }

  const length = calculated(validation.length, values, variables)
  const min = calculated(validation.min, values, variables)
  const max = calculated(validation.max, values, variables)
  if (length != null && 'length' in schema) schema = (schema as yup.StringSchema).length(length, adapter.translate('value_length_error'))
  if (min != null && 'min' in schema) schema = (schema as yup.StringSchema).min(min, adapter.translate('value_length_error'))
  if (max != null && 'max' in schema) schema = (schema as yup.StringSchema).max(max, adapter.translate('value_length_error'))

  const pattern = calculated(validation.pattern, values, variables)
  if (Array.isArray(pattern) && typeof pattern[0] === 'string') {
    const message = field.name === 'u_phone'
      ? `${adapter.translate('phone_pattern_error')} ${adapter.phoneMask()}`
      : adapter.translate('value_length_error')
    schema = (schema as yup.StringSchema).matches(new RegExp(pattern[0], pattern[1] ?? ''), message)
  }

  if (isRequired(field, values, variables)) {
    if (type === 'checkbox') schema = (schema as yup.BooleanSchema).oneOf([true], adapter.translate('required_field'))
    else if (type === 'file') schema = (schema as yup.ArraySchema<unknown[], yup.AnyObject, undefined, ''>).min(1, adapter.translate('required_field'))
    else schema = schema.required(adapter.translate('required_field'))
  } else {
    schema = schema.nullable().optional()
  }
  return schema
}

export default function JSONForm({
  fields,
  onSubmit,
  onChange,
  state = {},
  defaultValues = {},
  errors = {},
  language,
  configReady = true,
  adapter: providedAdapter,
}: JSONFormProps) {
  const adapter = useMemo<JSONFormAdapter>(() => ({
    ...defaultJSONFormAdapter,
    ...providedAdapter,
    language: language ?? providedAdapter?.language ?? defaultJSONFormAdapter.language,
  }), [language, providedAdapter])
  const [unfilteredValues, setValues] = useState<TFormValues>(
    () => initialValues(fields, defaultValues, adapter.data),
  )
  const [form, values] = useMemo(
    () => prepareForm(fields, unfilteredValues, adapter.data),
    [fields, unfilteredValues, adapter.data],
  )

  const baseVariables = useMemo<Record<string, unknown>>(() => ({
    form: {
      pending: state.pending,
      submitSuccess: state.success,
      submitFailed: state.failed,
      errorMessage: state.errorMessage,
    },
  }), [state])

  const validationSchema = useMemo(() => {
    const shape: Record<string, yup.AnySchema> = {}
    for (const field of form) {
      if (!field.name) continue
      const visible = parseVariable(calculated(field.visible ?? true, values, baseVariables), baseVariables)
      const disabled = parseVariable(calculated(field.disabled ?? false, values, baseVariables), baseVariables)
      if (!visible || disabled) continue
      shape[field.name] = validationFor(field, values, baseVariables, adapter)
    }
    return yup.object(shape)
  }, [form, values, baseVariables, adapter])

  const isValid = validationSchema.isValidSync(values)
  const variables = useMemo<Record<string, unknown>>(() => ({
    ...baseVariables,
    form: { ...(baseVariables.form as object), valid: isValid, invalid: !isValid },
  }), [baseVariables, isValid])

  const handleChange = useCallback((_event: unknown, name: string, value: unknown) => {
    setValues(current => ({ ...current, [name]: value }))
    onChange?.(name, value)
  }, [onChange])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!onSubmit) return
    try {
      validationSchema.validateSync(values, { abortEarly: false })
    } catch {
      return
    }
    const submitted: TFormValues = {}
    for (const field of form) {
      const type = calculated(field.type ?? 'text', values, variables)
      if (!(field.submit ?? true) || type === 'button' || type === 'submit') continue
      const key = String(calculated(field.name, values, variables) ?? '')
      if (key) submitted[key] = values[key]
    }
    onSubmit(makeNested(submitted))
  }

  if (!configReady) return null
  return (
    <div className="json-form">
      <form onSubmit={handleSubmit} noValidate>
        {form.map((field, index) => field.name ? (
          <JSONFormElement
            key={`${field.name}-${index}`}
            element={field}
            values={values}
            variables={variables}
            onChange={handleChange}
            validationSchema={validationFor(field, values, variables, adapter)}
            language={adapter.language}
            adapter={adapter}
            errors={errors}
          />
        ) : (
          <CustomComponent key={`component-${index}`} {...field} values={values} variables={variables} adapter={adapter} />
        ))}
      </form>
    </div>
  )
}

export * from './types'
export * from './utils'
