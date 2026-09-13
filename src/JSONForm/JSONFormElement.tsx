import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import cn from 'classnames'
import type { AnySchema } from 'yup'
import { defaultJSONFormAdapter, type JSONFormAdapter, type Language } from './adapters'
import { calculated, getTranslation, isRequired, optionData, parseVariable } from './utils'
import type { TFormElement, TFormValues } from './types'

interface Props {
  element: TFormElement
  validationSchema?: AnySchema
  onChange: (event: unknown, name: string, value: unknown) => void
  values?: TFormValues
  language?: Language
  variables?: Record<string, unknown>
  errors?: Record<string, unknown>
  adapter?: JSONFormAdapter
}

type InputElement = HTMLInputElement | HTMLSelectElement
type FileValue = [unknown, File]

export default function JSONFormElement({
  element: formElement,
  onChange,
  values = {},
  validationSchema,
  language = { iso: 'ru' },
  variables = {},
  errors = {},
  adapter = defaultJSONFormAdapter,
}: Props) {
  const name = String(calculated(formElement.name, values, variables) ?? '')
  const type = calculated(formElement.type ?? 'text', values, variables) ?? 'text'
  const value = values[name]
  const [errorMessage, setErrorMessage] = useState('')
  const [files, setFiles] = useState<FileValue[]>(Array.isArray(value) ? value as FileValue[] : [])

  useEffect(() => {
    if (type === 'file' && Array.isArray(value)) setFiles(value as FileValue[])
  }, [type, value])

  const validate = useCallback((nextValue: unknown) => {
    if (!validationSchema) return
    void validationSchema.validate(nextValue)
      .then(() => setErrorMessage(''))
      .catch((error: Error) => setErrorMessage(error.message))
  }, [validationSchema])

  const visible = parseVariable(calculated(formElement.visible ?? true, values, variables), variables)
  if (!visible) return null

  const disabled = Boolean(parseVariable(calculated(formElement.disabled ?? false, values, variables), variables))
  const common = {
    name,
    disabled,
    onChange(event: ChangeEvent<InputElement>) {
      const nextValue = type === 'select' ? event.target.value || null : event.target.value
      validate(nextValue)
      onChange(event, event.target.name, nextValue)
    },
    onBlur(event: ChangeEvent<InputElement>) {
      validate(type === 'select' ? event.target.value || null : event.target.value)
    },
  }

  let hint = formElement.hint
  const inferredHint = String(getTranslation(`hint_${name.split('.').at(-1)}`, adapter.translate))
  if (!hint && inferredHint !== `hint_${name.split('.').at(-1)}`) hint = inferredHint

  const hintElement = hint ? (
    <span className="element__hint">
      <span className="element__hint_icon">?</span>
      <span className="element__hint_message">{String(getTranslation(hint, adapter.translate))}</span>
    </span>
  ) : null

  let labelElement = formElement.label == null ? null : (
    <div className="element__label">
      {String(getTranslation(calculated(formElement.label, values, variables), adapter.translate) ?? '')}
      {isRequired(formElement, values, variables) && <span className="element__required">*</span>}
      {hintElement}
    </div>
  )

  if (type === 'hidden') return <input type="hidden" name={name} value={String(value ?? '')} />
  if (type === 'button' || type === 'submit') return (
    <button className="button json-form-button" type={type} disabled={disabled}>
      {String(getTranslation(calculated(formElement.label, values, variables), adapter.translate) ?? '')}
    </button>
  )

  let control: React.ReactNode
  const options = optionData(formElement, values, variables, adapter.data)

  if (type === 'select') {
    const required = isRequired(formElement, values, variables)
    control = (
      <select {...common} value={String(value ?? '')} className="element__select_input">
        {!required && <option value="">-</option>}
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label ? String(getTranslation(option.label, adapter.translate)) : option.labelLang?.[language.iso] ?? String(option.value)}
          </option>
        ))}
      </select>
    )
  } else if (type === 'radio') {
    control = options.map(option => (
      <label key={option.value} className="element__radio">
        <input
          {...common}
          disabled={disabled || option.disabled}
          type="radio"
          className="element__radio_input"
          value={option.value}
          checked={value == option.value}
        />
        <span>{option.label ? String(getTranslation(option.label, adapter.translate)) : option.labelLang?.[language.iso] ?? String(option.value)}</span>
      </label>
    ))
  } else if (type === 'checkbox') {
    labelElement = null
    control = (
      <label className="element__checkbox">
        <input
          name={name}
          disabled={disabled}
          type="checkbox"
          className="element__checkbox_input"
          checked={Boolean(value)}
          onChange={event => { validate(event.target.checked); onChange(event, name, event.target.checked) }}
        />
        <span>
          <span>{String(getTranslation(calculated(formElement.label, values, variables), adapter.translate) ?? '')}</span>
          {isRequired(formElement, values, variables) && <span className="element__required">*</span>}
        </span>
      </label>
    )
  } else if (type === 'file') {
    control = (
      <div className="element__file">
        {files.map((file, index) => (
          <button
            className="element__file_value"
            type="button"
            key={`${file[1].name}-${index}`}
            aria-label={`Удалить ${file[1].name}`}
            onClick={event => {
              const next = files.filter((_, itemIndex) => itemIndex !== index)
              setFiles(next)
              onChange(event, name, next.length ? next : null)
            }}
          >
            {file[1].type.startsWith('image/') ? <img src={URL.createObjectURL(file[1])} alt="" /> : file[1].name}
          </button>
        ))}
        <label className={cn('element__file_add', { element__file_add_disabled: disabled })}>
          <span>Добавить файл</span>
          <input
            className="element__file_input"
            name={name}
            disabled={disabled}
            type="file"
            multiple={formElement.multiple}
            accept={formElement.accept}
            onChange={event => {
              const selected: FileValue[] = Array.from(event.target.files ?? []).map(file => [null, file])
              const next = formElement.multiple ? [...files, ...selected] : selected.slice(0, 1)
              setFiles(next)
              validate(next)
              onChange(event, name, next)
              event.target.value = ''
            }}
          />
        </label>
      </div>
    )
  } else {
    control = (
      <input
        {...common}
        value={String(value ?? '')}
        type={type === 'phone' ? 'tel' : type}
        className="element__text_input"
        placeholder={type === 'phone' ? adapter.phoneMask() : formElement.placeholder}
      />
    )
  }

  const Wrap = ['file', 'radio', 'checkbox'].includes(type) ? 'div' : 'label'
  const externalError = errors[name]
  return (
    <Wrap className={cn('element__field', { 'element__field--error': externalError || errorMessage })}>
      {labelElement}
      <div className={type === 'file' || !hintElement ? '' : 'element__input'}>
        {control}
        {!labelElement && hintElement}
      </div>
      {type === 'file' && formElement.accept?.includes('image') && <div className="element__field_subscription">{adapter.translate('subscription_images_upload')}</div>}
      {errorMessage && <div className="element__field_error">{errorMessage}</div>}
      {!errorMessage && Boolean(externalError) && <div className="element__field_error">{String(externalError)}</div>}
    </Wrap>
  )
}
