export type AuthErrorCode =
  | 'wrong_login'
  | 'wrong_password'
  | 'wrong_phone'
  | 'code_sent'
  | 'network'
  | 'protocol'
  | 'unauthorized'
  | 'unknown'

export class AuthApiError extends Error {
  readonly code: AuthErrorCode
  readonly status?: number
  readonly details?: unknown

  constructor(
    message: string,
    code: AuthErrorCode = 'unknown',
    options: { status?: number; details?: unknown; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'AuthApiError'
    this.code = code
    this.status = options.status
    this.details = options.details
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Неизвестная ошибка авторизации'
}
