import { UserRole } from '../auth'
import type { TForm, TFormElement } from '../JSONForm'
import type { JSONFormAdapter } from '../JSONForm/adapters'

const translations: Record<string, string> = {
  required_field: 'Обязательное поле',
  email_error: 'Укажите корректный email',
  value_length_error: 'Значение не соответствует ограничению',
  phone_pattern_error: 'Телефон указан неверно',
  subscription_images_upload: 'Допустимы изображения PNG и JPEG',
  password: 'Пароль',
  password_confirm: 'Повторите пароль',
}

/** Taxi host bridge; all window.data coupling is kept outside JSONForm. */
export function taxiFormAdapter(): JSONFormAdapter {
  const data = window.data ?? {}
  const iso = data.language?.iso
  return {
    data,
    language: { iso: typeof iso === 'string' ? iso : 'ru' },
    translate(value) {
      const configured = data.translations?.[value]
      return typeof configured === 'string' ? configured : translations[value] ?? value
    },
    phoneMask() {
      const value = data.site_constants?.def_maska_tel?.value
      return typeof value === 'string' ? value : '+7 (___) ___-__-__'
    },
  }
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

const emailPattern = ['^(([^<>()\\[\\].,;:\\s@"]+(\\.[^<>()\\[\\].,;:\\s@"]+)*)|(".+"))@(([^<>()[\\].,;:\\s@"]+\\.)+[^<>()[\\].,;:\\s@"]{2,})$', 'i']
const phonePattern = ['^[+]?\\d{1,3}[(]?\\d{3}[)]?[-\\s.]?\\d{3}[-\\s.]?\\d{3,6}$', 'i']
const driverVisible = [{ expression: [['u_role', '=', '2']], result: true }] as never

export const fallbackRegisterFields: TForm = [
  {
    name: 'u_role', label: 'Роль', type: 'radio', defaultValue: String(UserRole.Client),
    options: [{ value: String(UserRole.Client), label: 'Клиент' }, { value: String(UserRole.Driver), label: 'Водитель' }],
  },
  {
    name: 'registration_type', label: 'Способ регистрации', type: 'radio', defaultValue: 'e-mail', submit: false,
    options: [{ value: 'e-mail', label: 'Email' }, { value: 'phone', label: 'Телефон' }],
  },
  { name: 'u_name', label: 'Имя', validation: { required: true } },
  {
    name: 'u_email', label: 'Email', type: 'email',
    validation: {
      email: true,
      required: [{ expression: [['registration_type', '=', 'e-mail']], result: true }],
      pattern: emailPattern,
    },
  },
  {
    name: 'u_phone', label: 'Телефон', type: 'phone',
    validation: {
      required: [{ expression: [['registration_type', '=', 'phone']], result: true }],
      pattern: phonePattern,
    },
  },
  { name: 'ref_code', label: 'Реферальный код' },
  { name: 'promo_code', label: 'Промокод' },
  { name: 'u_city', label: 'Город', visible: driverVisible },
  {
    name: 'u_details.work_type', label: 'Тип работы', type: 'select', visible: driverVisible,
    options: [{ value: '0', label: 'Самозанятый' }, { value: '1', label: 'Компания' }],
  },
  { name: 'u_details.street', label: 'Улица', visible: driverVisible },
  { name: 'u_details.state', label: 'Регион / штат', visible: driverVisible },
  { name: 'u_details.card', label: 'Номер карты', visible: driverVisible, validation: { pattern: ['^$|^\\d{16}$', ''] } },
  { name: 'passport_photo', label: 'Паспорт', type: 'file', multiple: true, accept: 'image/png,image/jpeg', visible: driverVisible },
  { name: 'driver_license_photo', label: 'Водительское удостоверение', type: 'file', multiple: true, accept: 'image/png,image/jpeg', visible: driverVisible },
  { name: 'license_photo', label: 'Лицензия', type: 'file', multiple: true, accept: 'image/png,image/jpeg', visible: driverVisible },
  { name: 'u_car.cm_id', label: 'ID модели автомобиля', visible: driverVisible },
  { name: 'u_car.seats', label: 'Мест', type: 'number', defaultValue: 4, visible: driverVisible, validation: { min: 1, max: 20 } },
  { name: 'u_car.registration_plate', label: 'Госномер', visible: driverVisible },
  { name: 'u_car.color', label: 'Цвет', visible: driverVisible },
  { name: 'u_car.cc_id', label: 'ID класса', visible: driverVisible },
  { name: 'agreement', label: 'Я принимаю условия обработки данных', type: 'checkbox', submit: false, validation: { required: true } },
  { name: 'register_submit', label: 'Создать аккаунт', type: 'submit' },
]

export const fallbackProfileFields: TForm = [
  { name: 'u_name', label: 'Имя' },
  { name: 'u_family', label: 'Фамилия' },
  { name: 'u_middle', label: 'Отчество' },
  { name: 'u_phone', label: 'Телефон', type: 'phone', validation: { pattern: phonePattern } },
  { name: 'u_email', label: 'Email', type: 'email', validation: { email: true } },
  { name: 'u_city', label: 'Город' },
  { name: 'u_lang', label: 'Язык' },
  { name: 'u_currency', label: 'Валюта' },
  { name: 'u_lang_skills', label: 'Языки' },
  { name: 'u_description', label: 'О себе' },
  { name: 'u_birthday', label: 'Дата рождения' },
  { name: 'passport_photo', label: 'Новые фото паспорта', type: 'file', multiple: true, accept: 'image/png,image/jpeg' },
  { name: 'driver_license_photo', label: 'Новые фото водительского удостоверения', type: 'file', multiple: true, accept: 'image/png,image/jpeg' },
  { name: 'u_gps_software', label: 'Навигация' },
  { name: 'u_active', label: 'Активен', type: 'checkbox' },
  { name: 'ref_code', label: 'Реферальный код' },
  { name: 'promo_code', label: 'Промокод' },
  { name: 'profile_submit', label: 'Сохранить', type: 'submit' },
]

export function readConfiguredFields(name: 'form_register' | 'form_profile', fallback: TForm): TForm {
  const raw = window.data?.site_constants?.[name]?.value
  if (typeof raw !== 'string') return fallback
  const parsed = JSON.parse(raw) as { fields?: TForm }
  if (!Array.isArray(parsed.fields)) throw new Error(`Bad JSON form in site_constants.${name}`)
  return parsed.fields
}

const hasPassword = (fields: TForm) => fields.some(field => field.name === 'password' || field.name === 'data.password')
const hasPasswordConfirm = (fields: TForm) => fields.some(field => field.name === 'password_confirm')

export function withPasswordFields(fields: TForm): TForm {
  const added: TFormElement[] = []
  if (!hasPassword(fields)) added.push({ name: 'password', label: 'password', type: 'password', validation: { required: true, min: 8 } })
  if (!hasPasswordConfirm(fields)) added.push({ name: 'password_confirm', label: 'password_confirm', type: 'password', validation: { required: true, min: 8 } })
  if (!added.length) return fields

  const isAgreement = (field: TFormElement) => field.type === 'checkbox' && !['type', 'u_role', 'role'].includes(String(field.name ?? ''))
  const index = fields.findIndex(isAgreement)
  const submitIndex = fields.findIndex(field => field.type === 'submit')
  const insertion = index >= 0 ? index : submitIndex
  return insertion < 0
    ? [...fields, ...added]
    : [...fields.slice(0, insertion), ...added, ...fields.slice(insertion)]
}
