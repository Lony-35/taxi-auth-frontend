import type { TaxiUser } from './types'
import { UserCheckState, UserRole } from './types'

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'boolean') return value
  return Boolean(Number(value))
}

function details(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return { raw: value }
    }
  }
  return undefined
}

export function normalizeUser(value: unknown): TaxiUser {
  if (!value || typeof value !== 'object') throw new Error('Невалидный пользователь')
  const raw = value as Record<string, unknown>
  const id = raw.u_id
  if (id === undefined || id === null) throw new Error('У пользователя отсутствует u_id')
  const numericRole = Number(raw.u_role)
  const numericCheckState = Number(raw.u_check_state)

  return {
    ...raw,
    u_id: String(id),
    u_name: String(raw.u_name ?? ''),
    u_email: String(raw.u_email ?? ''),
    u_phone: raw.u_phone === undefined ? undefined : String(raw.u_phone),
    u_role: (Number.isFinite(numericRole) ? numericRole : UserRole.Client) as UserRole,
    u_check_state: Number.isFinite(numericCheckState) && numericCheckState > 0
      ? numericCheckState as UserCheckState
      : undefined,
    u_active: optionalBoolean(raw.u_active),
    u_phone_checked: optionalBoolean(raw.u_phone_checked),
    u_details: details(raw.u_details),
  }
}
