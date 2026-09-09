export type IdentityId = string

export type IdentityStatus = 'ACTIVE' | 'PENDING' | 'REJECTED' | 'BLOCKED'

/** Provider-defined, provider-neutral role identifier, for example `member`. */
export type Role = string

/** Provider-neutral capability identifier, for example `profile.update`. */
export type Permission = string

export interface IdentityProfile {
  name?: string
  familyName?: string
  middleName?: string
  email?: string
  phone?: string
  photo?: string
  city?: string
  language?: string
}

export interface Identity {
  id: IdentityId
  status: IdentityStatus
  profile: IdentityProfile
  roles: Role[]
  permissions: Permission[]
}

export interface Credentials {
  identifier: string
  secret?: string
  kind: 'email' | 'phone' | 'username'
}

/** Opaque provider-owned reference. Identity Core never inspects its value. */
export type SessionReference = string & { readonly __sessionReference: unique symbol }

export interface Session {
  identity: Identity
  reference: SessionReference
}

export interface RegistrationRequest {
  credentials: Credentials
  profile: IdentityProfile
}

export interface ProfileUpdate {
  profile: Partial<IdentityProfile>
}

export interface RegistrationResult {
  identity: Identity | null
  session: Session | null
}
