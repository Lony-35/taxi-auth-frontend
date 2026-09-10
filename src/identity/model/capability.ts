/** What an IdentityProvider implementation can do; not what an identity may do. */
export const identityCapabilities = [
  'AUTHENTICATION',
  'REGISTRATION',
  'SESSION_RESTORE',
  'PROFILE_READ',
  'PROFILE_UPDATE',
  'PASSWORD_RECOVERY',
  'LOGOUT',
  'ACL',
] as const

export type IdentityCapability = typeof identityCapabilities[number]

export const fullIdentityCapabilities: readonly IdentityCapability[] =
  Object.freeze([...identityCapabilities])
