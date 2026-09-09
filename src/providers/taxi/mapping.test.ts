import { describe, expect, it } from 'vitest'
import type { SessionReference } from '../../identity'
import { UserCheckState, UserRole, type TaxiUser } from './types'
import {
  taxiAuthToSession,
  taxiProfileToIdentityProfile,
  taxiRoleToRole,
  taxiStatusToIdentityStatus,
  taxiUserToIdentity,
  taxiUserToPermissions,
} from './mapping'

const taxiUser: TaxiUser = {
  u_id: '7', u_name: 'Valentin', u_email: 'v@example.com',
  u_phone: '+123', u_role: UserRole.Driver, u_check_state: UserCheckState.Active,
}

describe('Taxi to Identity mapping', () => {
  it('maps a Taxi user to the universal Identity model', () => {
    expect(taxiUserToIdentity(taxiUser)).toEqual({
      id: '7', status: 'ACTIVE',
      profile: { name: 'Valentin', email: 'v@example.com', phone: '+123' },
      roles: ['driver'], permissions: [],
    })
  })

  it('maps each confirmed Taxi role inside the adapter', () => {
    expect(taxiRoleToRole(UserRole.Client)).toEqual(['client'])
    expect(taxiRoleToRole(UserRole.Driver)).toEqual(['driver'])
    expect(taxiRoleToRole(UserRole.Administrator)).toEqual(['administrator'])
    expect(taxiRoleToRole(UserRole.Agent)).toEqual(['agent'])
  })

  it('does not invent permissions absent from the Taxi contract', () => {
    expect(taxiUserToPermissions(taxiUser)).toEqual([])
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

  it('maps Taxi auth using a provider-owned session handle', () => {
    const tokens = { token: 'token', u_hash: 'hash' }
    const reference = 'taxi-session:test' as SessionReference
    const session = taxiAuthToSession({ user: taxiUser, tokens }, reference)
    expect(session.identity.id).toBe('7')
    expect(session.reference).toBe(reference)
    expect(session.reference).not.toContain(tokens.token)
  })
})
