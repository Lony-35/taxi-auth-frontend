import type {
  Identity,
  IdentityProfile,
  IdentityStatus,
  Session,
  SessionReference,
} from '../../identity'
import type { AuthSession, AuthTokens, AuthUser } from '../../auth/types'
import { UserCheckState } from '../../auth/types'

export function taxiStatusToIdentityStatus(user: AuthUser): IdentityStatus {
  switch (user.u_check_state) {
    case UserCheckState.Active: return 'ACTIVE'
    case UserCheckState.Rejected: return 'REJECTED'
    case UserCheckState.Blocked: return 'BLOCKED'
    case UserCheckState.Required: return 'PENDING'
    default: return user.u_active === false ? 'PENDING' : 'ACTIVE'
  }
}

export function taxiProfileToIdentityProfile(user: AuthUser): IdentityProfile {
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

export function taxiUserToIdentity(user: AuthUser): Identity {
  return {
    id: user.u_id,
    status: taxiStatusToIdentityStatus(user),
    profile: taxiProfileToIdentityProfile(user),
  }
}

export function taxiTokensToSessionReference(tokens: AuthTokens): SessionReference {
  return JSON.stringify([tokens.token, tokens.u_hash]) as SessionReference
}

export function sessionReferenceToTaxiTokens(reference: SessionReference): AuthTokens {
  const parsed: unknown = JSON.parse(reference)
  if (!Array.isArray(parsed) || parsed.length !== 2 || parsed.some(value => typeof value !== 'string')) {
    throw new Error('Invalid Taxi session reference')
  }
  return { token: parsed[0], u_hash: parsed[1] }
}

export function taxiAuthToSession(auth: AuthSession): Session {
  return {
    identity: taxiUserToIdentity(auth.user),
    reference: taxiTokensToSessionReference(auth.tokens),
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
