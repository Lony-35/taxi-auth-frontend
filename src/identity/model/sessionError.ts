export type SessionErrorCode =
  | 'NO_SESSION'
  | 'INVALID_REFERENCE'
  | 'EXPIRED_SESSION'
  | 'INVALID_PROVIDER_CREDENTIALS'
  | 'RESTORE_FAILED'
  | 'LOGOUT_FAILED'

const safeMessages: Record<SessionErrorCode, string> = {
  NO_SESSION: 'No session is available',
  INVALID_REFERENCE: 'Session reference is invalid',
  EXPIRED_SESSION: 'Session has expired',
  INVALID_PROVIDER_CREDENTIALS: 'Provider session is invalid',
  RESTORE_FAILED: 'Session restore failed',
  LOGOUT_FAILED: 'Session logout failed',
}

/** A provider-neutral, deliberately secret-free session failure. */
export class IdentitySessionError extends Error {
  constructor(readonly code: SessionErrorCode) {
    super(safeMessages[code])
    this.name = 'IdentitySessionError'
  }
}

export function toIdentitySessionError(
  error: unknown,
  fallback: SessionErrorCode,
): IdentitySessionError {
  return error instanceof IdentitySessionError
    ? error
    : new IdentitySessionError(fallback)
}
