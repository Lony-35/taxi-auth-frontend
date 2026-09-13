import { t } from './adapters'
import type {
  TCalculate,
  TCondition,
  TExpression,
  TFormElement,
  TFormValues,
  TOperation,
  TOption,
  TOptionData,
} from './types'

export const isExpression = (value: unknown): value is TExpression<unknown> => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<TExpression<unknown>>
  return Array.isArray(candidate.expression)
    && Object.prototype.hasOwnProperty.call(candidate, 'result')
    && candidate.expression.every(item => Array.isArray(item) && item.length === 3)
}

export const isCalculate = (value: unknown): value is TCalculate<unknown> =>
  Array.isArray(value) && value.length > 0 && value.every(isExpression)

export const getConditionResult = (left: unknown, op: TOperation, right: unknown): boolean => {
  switch (op) {
    case '=': return left == right
    case '!=': return left != right
    case '>': return (left as number) > (right as number)
    case '<': return (left as number) < (right as number)
    case '>=': return (left as number) >= (right as number)
    case '<=': return (left as number) <= (right as number)
  }
}

export const getTranslation = (value: unknown): unknown =>
  typeof value === 'string' ? t(value) : value

export const deepGet = (source: unknown, path: string): unknown =>
  path.split('.').filter(Boolean).reduce<unknown>((result, key) =>
    result && typeof result === 'object' ? (result as Record<string, unknown>)[key] : undefined,
  source)

export const parseVariable = (value: unknown, variables: Record<string, unknown>): unknown =>
  typeof value === 'string' && value.startsWith('@')
    ? deepGet(variables, value.slice(1))
    : value

export function getCalculation<Result>(
  calculate: Result | TCalculate<Result>,
  values?: TFormValues,
  variables: Record<string, unknown> = {},
): Result | ((currentValues: TFormValues) => Result | undefined) | undefined {
  if (!isCalculate(calculate)) return values === undefined ? () => calculate as Result : calculate as Result

  const evaluate = (currentValues: TFormValues): Result | undefined => {
    for (const item of calculate as TCalculate<Result>) {
      const matches = item.expression.every(([key, operation, right]: TCondition) => {
        const fieldValue = currentValues[key]
        const left = fieldValue === undefined ? parseVariable(key, variables) : fieldValue
        return getConditionResult(left, operation, right)
      })
      if (matches) return item.result
    }
    return undefined
  }
  return values === undefined ? evaluate : evaluate(values)
}

export const calculated = <Result>(
  value: Result | TCalculate<Result> | undefined,
  values: TFormValues,
  variables: Record<string, unknown> = {},
): Result | undefined => value === undefined
  ? undefined
  : getCalculation(value, values, variables) as Result | undefined

export const isRequired = (
  field: TFormElement,
  values: TFormValues = {},
  variables: Record<string, unknown> = {},
): boolean => field.validation?.required != null
  ? Boolean(calculated(field.validation.required, values, variables))
  : ['select', 'radio'].includes(String(calculated(field.type, values, variables) ?? field.type))

export function optionData(field: TFormElement, values: TFormValues, variables: Record<string, unknown> = {}): TOption[] {
  const resolved = calculated(field.options, values, variables)
  if (!resolved) return []
  if (Array.isArray(resolved)) return resolved.filter(item => item && typeof item === 'object' && 'value' in item) as TOption[]

  const descriptor = resolved as TOptionData
  const map = deepGet(window.data, descriptor.path)
  if (!map || typeof map !== 'object') return []
  const selected = descriptor.filter ? values[descriptor.filter.by] : undefined
  return Object.entries(map as Record<string, unknown>)
    .filter(([, item]) => !descriptor.filter || (
      item != null && typeof item === 'object'
      && (item as Record<string, unknown>)[descriptor.filter.field] === selected
    ))
    .map(([value, labelLang]) => ({
      value,
      labelLang: labelLang as Record<string, string>,
    }))
}

export function* getOptions(field: TFormElement): Iterable<TOption> {
  yield* optionData(field, {}, {})
}

export function makeFlat(value: Record<string, unknown>, prefix = '', result: TFormValues = {}): TFormValues {
  for (const [key, item] of Object.entries(value ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key
    if (item && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Blob))
      makeFlat(item as Record<string, unknown>, path, result)
    else
      result[path] = item
  }
  return result
}

export function makeNested(values: TFormValues): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [path, value] of Object.entries(values)) {
    const keys = path.split('.')
    let target = result
    keys.forEach((key, index) => {
      if (index === keys.length - 1) target[key] = value
      else target = target[key] && typeof target[key] === 'object'
        ? target[key] as Record<string, unknown>
        : target[key] = {}
    })
  }
  return result
}
