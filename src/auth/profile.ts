import { UserCheckState, UserRole, type AuthUser } from './types'

export const clientProfileFields = new Set([
  'u_role', 'u_name', 'u_family', 'u_middle', 'u_phone', 'u_email',
  'u_photo', 'u_lang', 'u_currency', 'ref_code', 'u_details',
])

export const driverRequiredProfileFields = new Set([
  'u_role', 'u_name', 'u_family', 'u_middle', 'u_phone', 'u_email',
  'u_photo', 'u_city', 'u_lang_skills', 'u_description', 'u_birthday',
  'ref_code', 'u_details',
])

export const driverActiveProfileFields = new Set([
  'u_role', 'u_lang', 'u_currency', 'u_gps_software', 'u_active',
  'out_drive', 'out_address', 'out_latitude', 'out_longitude',
  'out_est_datetime', 'out_s_address', 'out_s_latitude',
  'out_s_longitude', 'out_passengers', 'out_luggage', 'ref_code',
  'u_details',
])

export const carProfileFields = new Set([
  'cm_id', 'seats', 'registration_plate', 'color', 'photo', 'details', 'cc_id',
])

export function allowedProfileFields(user: AuthUser): Set<string> {
  if (user.u_role === UserRole.Client) return clientProfileFields
  if (user.u_role !== UserRole.Driver) return new Set()
  if (!user.u_check_state || user.u_check_state === UserCheckState.Required) {
    return driverRequiredProfileFields
  }
  if (user.u_check_state === UserCheckState.Active) return driverActiveProfileFields
  return new Set()
}

export function filterFields(
  values: Record<string, unknown>,
  allowed: Set<string>,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)))
}

export function toLegacyDetails(details: Record<string, unknown>) {
  return Object.entries(details).map(([key, value]) => ['=', [key], value ?? ''])
}
