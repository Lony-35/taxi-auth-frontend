import type { IdentityCapability } from './capability'

export type IdentityOperationErrorCode =
  | 'UNSUPPORTED_CAPABILITY'
  | 'AUTHENTICATION_FAILED'
  | 'AUTHORIZATION_FAILED'
  | 'VALIDATION_FAILED'
  | 'PROVIDER_OPERATION_FAILED'

const safeMessages: Record<IdentityOperationErrorCode, string> = {
  UNSUPPORTED_CAPABILITY: 'Identity capability is not supported',
  AUTHENTICATION_FAILED: 'Authentication failed',
  AUTHORIZATION_FAILED: 'Identity is not authorized for this operation',
  VALIDATION_FAILED: 'Identity operation input is invalid',
  PROVIDER_OPERATION_FAILED: 'Identity provider operation failed',
}

/** Provider-neutral, secret-free failure exposed to Identity consumers. */
export class IdentityOperationError extends Error {
  constructor(
    readonly code: IdentityOperationErrorCode,
    readonly capability?: IdentityCapability,
  ) {
    super(safeMessages[code])
    this.name = 'IdentityOperationError'
  }
}
