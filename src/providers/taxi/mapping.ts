import type {
  Identity,
  IdentityProfile,
  IdentityStatus,
  Permission,
  Role,
  Session,
  SessionReference,
} from '../../identity'
import type { TaxiAuthSession, TaxiUser } from './types'
import { UserCheckState, UserRole } from './types'

const taxiRoleMap: Readonly<Record<UserRole, Role>> = {
  [UserRole.Client]: 'client',
  [UserRole.Driver]: 'driver',
  [UserRole.Administrator]: 'administrator',
  [UserRole.Agent]: 'agent',
}

export function taxiRoleToRole(role: UserRole): Role[] {
  const mapped = taxiRoleMap[role]
  return mapped ? [mapped] : []
}

/**
 * The current Taxi user contract exposes a role but no capabilities/permissions.
 * Returning an empty set is deliberate: the adapter must not invent authorization facts.
 */
export function taxiUserToPermissions(_user: TaxiUser): Permission[] {
  return []
}

export function taxiStatusToIdentityStatus(user: TaxiUser): IdentityStatus {
  switch (user.u_check_state) {
    case UserCheckState.Active: return 'ACTIVE'
    case UserCheckState.Rejected: return 'REJECTED'
    case UserCheckState.Blocked: return 'BLOCKED'
    case UserCheckState.Required: return 'PENDING'
    default: return user.u_active === false ? 'PENDING' : 'ACTIVE'
  }
}

export function taxiProfileToIdentityProfile(user: TaxiUser): IdentityProfile {
  return {
    name: user.u_name || undefined,
    familyName: user.u_family || undefined,
    middleName: user.u_middle || undefined,
    email: user.u_email || undefined,
    phone: user.u_phone || undefined,
    photo: user.u_photo || undefined,
    city: user.u_city || undefined,
    language: user.u_lang || undefined,
  }
}

export function taxiUserToIdentity(user: TaxiUser): Identity {
  return {
    id: user.u_id,
    status: taxiStatusToIdentityStatus(user),
    profile: taxiProfileToIdentityProfile(user),
    roles: taxiRoleToRole(user.u_role),
    permissions: taxiUserToPermissions(user),
  }
}

export function taxiAuthToSession(auth: TaxiAuthSession, reference: SessionReference): Session {
  return {
    identity: taxiUserToIdentity(auth.user),
    reference,
  }
}

export function identityProfileToTaxiValues(profile: Partial<IdentityProfile>): Record<string, string> {
  const values: Record<string, string> = {}
  if (profile.name !== undefined) values.u_name = profile.name
  if (profile.familyName !== undefined) values.u_family = profile.familyName
  if (profile.middleName !== undefined) values.u_middle = profile.middleName
  if (profile.email !== undefined) values.u_email = profile.email
  if (profile.phone !== undefined) values.u_phone = profile.phone
  if (profile.photo !== undefined) values.u_photo = profile.photo
  if (profile.city !== undefined) values.u_city = profile.city
  if (profile.language !== undefined) values.u_lang = profile.language
  return values
}
