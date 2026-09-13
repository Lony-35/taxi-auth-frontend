export type TElementType =
  | 'text'
  | 'email'
  | 'number'
  | 'phone'
  | 'password'
  | 'hidden'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'button'
  | 'submit'

export type TOperation = '=' | '<' | '>' | '<=' | '>=' | '!='

export type TOption = {
  label?: string
  labelLang?: Record<string, string>
  disabled?: boolean
  value: string | number
}

export type TOptionData = {
  path: string
  filter?: { by: string; field: string }
}

export type TCondition = [string, TOperation, unknown]
export type TExpression<Result> = { expression: TCondition[]; result: Result }
export type TCalculate<Result> = TExpression<Result>[]

export type TFormElement = {
  name?: string
  placeholder?: string
  hint?: string
  defaultValue?: string | number | boolean
  label?: string | TCalculate<string>
  type?: TElementType | TCalculate<TElementType>
  options?: TOptionData | TOption[] | TCalculate<TOptionData | TOption[]>
  multiple?: boolean
  accept?: string
  visible?: boolean | string | TCalculate<boolean | string>
  disabled?: boolean | string | TCalculate<boolean | string>
  validation?: {
    email?: boolean | TCalculate<boolean>
    required?: boolean | TCalculate<boolean>
    length?: number | TCalculate<number>
    min?: number | TCalculate<number>
    max?: number | TCalculate<number>
    pattern?: string[] | TCalculate<string[]>
  }
  submit?: boolean
  component?: string
  props?: Record<string, unknown>
}

export type TForm = TFormElement[]
export type TFormValues = Record<string, unknown>

export type JSONFormState = {
  success?: boolean
  failed?: boolean
  pending?: boolean
  errorMessage?: string
}

