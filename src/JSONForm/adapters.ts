export type Language = { iso: string }

const translations: Record<string, string> = {
  required_field: 'Обязательное поле',
  email_error: 'Укажите корректный email',
  value_length_error: 'Значение не соответствует ограничению',
  phone_pattern_error: 'Телефон указан неверно',
  subscription_images_upload: 'Допустимы изображения PNG и JPEG',
  password: 'Пароль',
  password_confirm: 'Повторите пароль',
}

export function t(value: string): string {
  const configured = window.data?.translations?.[value]
  if (typeof configured === 'string') return configured
  return translations[value] ?? value
}

export function currentLanguage(): Language {
  const iso = window.data?.language?.iso
  return { iso: typeof iso === 'string' ? iso : 'ru' }
}

export function phoneMask(): string {
  const value = window.data?.site_constants?.def_maska_tel?.value
  return typeof value === 'string' ? value : '+7 (___) ___-__-__'
}

declare global {
  interface Window {
    data?: {
      site_constants?: Record<string, { value?: unknown }>
      translations?: Record<string, string>
      language?: { iso?: string }
      [key: string]: unknown
    }
  }
}

