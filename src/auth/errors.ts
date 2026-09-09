/** Legacy aliases; the Taxi adapter owns the concrete API error. */
export { TaxiApiError as AuthApiError } from '../providers/taxi/errors'
export type { TaxiErrorCode as AuthErrorCode } from '../providers/taxi/errors'

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Неизвестная ошибка авторизации'
}
