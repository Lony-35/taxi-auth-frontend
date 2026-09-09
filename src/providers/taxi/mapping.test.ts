import { describe, expect, it } from 'vitest'
import { UserCheckState, UserRole, type AuthUser } from '../../auth/types'
import {
  sessionReferenceToTaxiTokens,
  taxiAuthToSession,
  taxiProfileToIdentityProfile,
  taxiStatusToIdentityStatus,
  taxiTokensToSessionReference,
  taxiUserToIdentity,
} from './mapping'

const taxiUser: AuthUser = {
  u_id: '7', u_name: 'Valentin', u_email: 'v@example.com',
  u_phone: '+123', u_role: UserRole.Driver, u_check_state: UserCheckState.Active,
}

describe('Taxi to Identity mapping', () => {
  it('maps a Taxi user to the universal Identity model', () => {
    expect(taxiUserToIdentity(taxiUser)).toEqual({
      id: '7', status: 'ACTIVE',
      profile: { name: 'Valentin', email: 'v@example.com', phone: '+123' },
    })
  })

  it('maps Taxi statuses explicitly', () => {
    expect(taxiStatusToIdentityStatus({ ...taxiUser, u_check_state: UserCheckState.Required })).toBe('PENDING')
    expect(taxiStatusToIdentityStatus({ ...taxiUser, u_check_state: UserCheckState.Rejected })).toBe('REJECTED')
    expect(taxiStatusToIdentityStatus({ ...taxiUser, u_check_state: UserCheckState.Blocked })).toBe('BLOCKED')
  })

  it('maps a Taxi profile without leaking DTO field names', () => {
    const profile = taxiProfileToIdentityProfile(taxiUser)
    expect(profile).toEqual({ name: 'Valentin', email: 'v@example.com', phone: '+123' })
    expect(profile).not.toHaveProperty('u_id')
    expect(profile).not.toHaveProperty('u_details')
  })

  it('maps Taxi auth to an opaque universal Session', () => {
    const tokens = { token: 'token', u_hash: 'hash' }
    const session = taxiAuthToSession({ user: taxiUser, tokens })
    expect(session.identity.id).toBe('7')
    expect(sessionReferenceToTaxiTokens(session.reference)).toEqual(tokens)
    expect(session.reference).toBe(taxiTokensToSessionReference(tokens))
  })
})
