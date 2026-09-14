import type { TForm } from '../JSONForm'

/**
 * Production-shaped Taxi site_constants snapshots used for compatibility
 * regression. They intentionally exercise the constructs used by the Taxi
 * repository's form_register/form_profile contract.
 */
export const taxiRegisterFields: TForm = [
  {
    name: 'u_role', label: 'Роль', type: 'radio', defaultValue: '1',
    options: [{ value: '1', label: 'Клиент' }, { value: '2', label: 'Водитель' }],
  },
  { name: 'country', label: 'Страна', type: 'select', defaultValue: 'ru', options: [{ value: 'ru', label: 'Россия' }, { value: 'by', label: 'Беларусь' }] },
  { name: 'u_name', label: 'Имя', validation: { required: true } },
  { name: 'u_email', label: 'Email', type: 'email', validation: { required: true, email: true } },
  { name: 'use_ref_code', label: 'Есть реферальный код', type: 'checkbox', submit: false },
  { name: 'ref_code', label: 'Реферальный код', visible: [{ expression: [['use_ref_code', '=', true]], result: true }] },
  { name: 'promo_code', label: 'Промокод' },
  {
    name: 'u_city', label: 'Город', type: 'select',
    options: { path: 'cities', filter: { by: 'country', field: 'country' } },
    visible: [{ expression: [['u_role', '=', '2']], result: true }],
  },
  {
    name: 'u_details.rate', label: 'Стаж', type: 'number',
    visible: [{ expression: [['u_role', '=', '2']], result: true }],
    validation: { min: [{ expression: [['u_role', '=', '2']], result: 1 }] },
  },
  { name: 'agreement', label: 'Принимаю условия', type: 'checkbox', submit: false, validation: { required: true } },
  { name: 'register_submit', label: 'Создать аккаунт', type: 'submit', disabled: '@form.invalid' },
]

export const taxiProfileFields: TForm = [
  { name: 'u_name', label: 'Имя', validation: { required: true } },
  { name: 'u_details', type: 'hidden' },
  { name: 'u_details.street', label: 'Улица' },
  { name: 'u_details.region', label: 'Регион' },
  { name: 'loyalty_tier', label: 'Уровень лояльности' },
  { name: 'promo_code', label: 'Промокод' },
  { name: 'profile_submit', label: 'Сохранить', type: 'submit', disabled: '@form.invalid' },
]

export const taxiSiteConstantsFixture = {
  form_register: { value: JSON.stringify({ fields: taxiRegisterFields }) },
  form_profile: { value: JSON.stringify({ fields: taxiProfileFields }) },
}
