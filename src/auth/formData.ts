export type DetailsSerializer = (details: Record<string, unknown>) => string

export const jsonDetailsSerializer: DetailsSerializer = details => JSON.stringify(details)

export function toFormData(
  values: Record<string, unknown>,
  serializeDetails: DetailsSerializer = jsonDetailsSerializer,
): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue

    if (key === 'u_details' && typeof value === 'object' && !Array.isArray(value)) {
      formData.append(key, serializeDetails(value as Record<string, unknown>))
      continue
    }

    if (typeof value === 'boolean') {
      formData.append(key, value ? '1' : '0')
      continue
    }

    if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof Blob))) {
      formData.append(key, JSON.stringify(value))
      continue
    }

    formData.append(key, value instanceof Blob ? value : String(value))
  }

  return formData
}
