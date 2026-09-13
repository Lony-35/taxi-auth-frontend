import { useCallback, useMemo, useState } from 'react'
import * as yup from 'yup'
import { currentLanguage, phoneMask, t, type Language } from './adapters'
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
}

function initialValues(fields: TForm, defaults: Record<string, unknown>): TFormValues {
  const result = makeFlat(defaults)
  const reverseDefaults: TFormValues = {}

  for (const field of fields) {
    if (!field.name || Array.isArray(field.options) || !field.options || !('filter' in field.options)) continue
    const source = field.options as TOptionData
    if (!source.filter) continue
    const current = result[field.name] ?? field.defaultValue
    const map = deepGet(window.data, source.path) as Record<string, Record<string, unknown>> | undefined
    const parent = current == null ? undefined : map?.[String(current)]
    const parentValue = parent?.[source.filter.field]
    if (parentValue != null) reverseDefaults[source.filter.by] = parentValue
  }

  for (const field of fields) {
    if (!field.name) continue
    let value = result[field.name] ?? reverseDefaults[field.name] ?? field.defaultValue ?? null
    if (value === null) {
      if (field.type === 'checkbox') value = false
      else if (['select', 'radio'].includes(String(field.type)) && isRequired(field)) value = optionData(field, result)[0]?.value ?? null
      else if (!field.type || ['text', 'email', 'phone', 'password', 'hidden'].includes(String(field.type))) value = ''
    }
    result[field.name] = value
  }
  return result
}

function prepareForm(fields: TForm, currentValues: TFormValues): [TForm, TFormValues] {
  const form: TForm = []
  const values = { ...currentValues }
  for (const field of fields) {
    const type = calculated(field.type ?? 'text', values)
    const resolvedOptions = calculated(field.options as never, values)
    if ((type === 'select' || type === 'radio') && resolvedOptions && !Array.isArray(resolvedOptions) && typeof resolvedOptions === 'object' && 'path' in resolvedOptions) {
      const options = optionData({ ...field, options: resolvedOptions as TOptionData }, values)
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

function validationFor(field: TFormElement, values: TFormValues, variables: Record<string, unknown>): yup.AnySchema {
  const type = calculated(field.type ?? 'text', values, variables) ?? 'text'
  const validation = field.validation ?? {}
  let schema: yup.AnySchema

  if (type === 'file') schema = yup.array()
  else if (type === 'number') schema = yup.number().transform((value, original) => original === '' ? undefined : value)
  else if (type === 'checkbox') schema = yup.boolean()
  else if (type === 'select') schema = yup.string().nullable()
  else schema = yup.string()

  if (type === 'email' || calculated(validation.email ?? false, values, variables)) {
    schema = (schema as yup.StringSchema).email(t('email_error'))
  }

  const length = calculated(validation.length, values, variables)
  const min = calculated(validation.min, values, variables)
  const max = calculated(validation.max, values, variables)
  if (length != null && 'length' in schema) schema = (schema as yup.StringSchema).length(length, t('value_length_error'))
  if (min != null && 'min' in schema) schema = (schema as yup.StringSchema).min(min, t('value_length_error'))
  if (max != null && 'max' in schema) schema = (schema as yup.StringSchema).max(max, t('value_length_error'))

  const pattern = calculated(validation.pattern, values, variables)
  if (Array.isArray(pattern) && typeof pattern[0] === 'string') {
    const message = field.name === 'u_phone' ? `${t('phone_pattern_error')} ${phoneMask()}` : t('value_length_error')
    schema = (schema as yup.StringSchema).matches(new RegExp(pattern[0], pattern[1] ?? ''), message)
  }

  if (isRequired(field, values, variables)) {
    if (type === 'checkbox') schema = (schema as yup.BooleanSchema).oneOf([true], t('required_field'))
    else if (type === 'file') schema = (schema as yup.ArraySchema<unknown[], yup.AnyObject, undefined, ''>).min(1, t('required_field'))
    else schema = schema.required(t('required_field'))
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
  language = currentLanguage(),
  configReady = true,
}: JSONFormProps) {
  const [unfilteredValues, setValues] = useState<TFormValues>(() => initialValues(fields, defaultValues))
  const [form, values] = useMemo(() => prepareForm(fields, unfilteredValues), [fields, unfilteredValues])

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
      shape[field.name] = validationFor(field, values, baseVariables)
    }
    return yup.object(shape)
  }, [form, values, baseVariables])

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
    const submitted = { ...values }
    for (const field of form) {
      const type = calculated(field.type ?? 'text', values, variables)
      if (!(field.submit ?? true) || type === 'button' || type === 'submit') {
        const key = String(calculated(field.name, values, variables) ?? '')
        if (key) delete submitted[key]
      }
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
            validationSchema={validationFor(field, values, variables)}
            language={language}
            errors={errors}
          />
        ) : (
          <CustomComponent key={`component-${index}`} {...field} values={values} variables={variables} />
        ))}
      </form>
    </div>
  )
}

export * from './types'
export * from './utils'
