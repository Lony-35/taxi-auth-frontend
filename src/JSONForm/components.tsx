import { useState } from 'react'
import { t } from './adapters'
import { calculated, parseVariable } from './utils'
import type { TCalculate, TFormValues } from './types'

type CustomProps = {
  component?: string
  props?: Record<string, unknown>
  values: TFormValues
  variables?: Record<string, unknown>
  visible?: boolean | string | TCalculate<boolean | string>
}

function CustomAlert({ message, onClose }: { message?: string; onClose?: () => void }) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null
  return (
    <div className="json-form-alert" role="alert">
      <span>{message ? t(message) : ''}</span>
      <button type="button" aria-label="Закрыть" onClick={() => { setVisible(false); onClose?.() }}>×</button>
    </div>
  )
}

export const customComponents: Record<string, React.ComponentType<any>> = { alert: CustomAlert }

export default function CustomComponent({ component, props = {}, values, visible, variables = {} }: CustomProps) {
  if (!component || !customComponents[component]) return null
  const resolvedVisible = parseVariable(calculated(visible ?? true, values, variables), variables)
  if (!resolvedVisible) return null
  const computed = Object.fromEntries(Object.entries(props).map(([key, value]) => [
    key,
    parseVariable(calculated(value as never, values, variables), variables),
  ]))
  const Component = customComponents[component]
  return <Component {...computed} />
}

