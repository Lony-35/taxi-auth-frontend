export type TaxiErrorCode =
  | 'wrong_login' | 'wrong_password' | 'wrong_phone' | 'code_sent'
  | 'network' | 'protocol' | 'unauthorized' | 'unknown'

export class TaxiApiError extends Error {
  readonly code: TaxiErrorCode
  readonly status?: number
  readonly details?: unknown

  constructor(
    message: string,
    code: TaxiErrorCode = 'unknown',
    options: { status?: number; details?: unknown; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'TaxiApiError'
    this.code = code
    this.status = options.status
    this.details = options.details
  }
}
