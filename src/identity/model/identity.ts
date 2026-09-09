export type IdentityId = string

export type IdentityStatus = 'ACTIVE' | 'PENDING' | 'REJECTED' | 'BLOCKED'

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
