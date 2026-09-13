// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import JSONForm from './index'
import type { TForm } from './types'
import { readConfiguredFields, taxiFormAdapter, withPasswordFields } from '../forms/config'
import { taxiSiteConstantsFixture } from '../forms/taxiSiteConstants.fixture'

afterEach(() => { cleanup(); delete window.data })

describe('JSONForm runtime', () => {
  it('renders conditional fields, filtered options, validates and submits nested values', () => {
    window.data = {
      places: {
        '1': { ru: 'Москва', country: 'ru' },
        '2': { ru: 'Минск', country: 'by' },
      },
    }
    const submitted = vi.fn()
    const fields: TForm = [
      { name: 'country', label: 'Страна', type: 'select', defaultValue: 'ru', options: [{ value: 'ru', label: 'Россия' }, { value: 'by', label: 'Беларусь' }] },
      { name: 'profile.city', label: 'Город', type: 'select', options: { path: 'places', filter: { by: 'country', field: 'country' } } },
      { name: 'profile.email', label: 'Email', type: 'email', validation: { required: true } },
      { name: 'extra', label: 'Дополнительно', visible: [{ expression: [['country', '=', 'by']], result: true }] },
      { name: 'send', label: 'Отправить', type: 'submit', disabled: '@form.invalid' },
    ]
    render(<JSONForm fields={fields} adapter={taxiFormAdapter()} onSubmit={submitted} />)

    expect(screen.getByRole('option', { name: 'Москва' })).toBeTruthy()
    expect(screen.queryByText('Дополнительно')).toBeNull()
    expect((screen.getByRole('button', { name: 'Отправить' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@example.com' } })
    fireEvent.change(screen.getByLabelText(/Страна/), { target: { value: 'by' } })
    expect(screen.getByText('Дополнительно')).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Минск' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Отправить' }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(submitted).toHaveBeenCalledWith(expect.objectContaining({
      country: 'by',
      profile: { city: '2', email: 'a@example.com' },
    }))
  })

  it('supports multiple files and exposes them through onChange', () => {
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:test'), configurable: true })
    const changed = vi.fn()
    const { container } = render(<JSONForm fields={[{ name: 'documents', label: 'Документы', type: 'file', multiple: true, accept: 'image/png' }]} onChange={changed} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['image'], 'passport.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(changed).toHaveBeenCalledWith('documents', [[null, file]])
    expect(screen.getByRole('button', { name: /Удалить passport\.png/ })).toBeTruthy()
  })

  it('runs the Taxi form_register site_constants contract without merging referral and promo', () => {
    window.data = {
      site_constants: taxiSiteConstantsFixture,
      cities: {
        '1': { ru: 'Москва', country: 'ru' },
        '2': { ru: 'Минск', country: 'by' },
      },
    }
    const submitted = vi.fn()
    const fields = withPasswordFields(readConfiguredFields('form_register', []))
    const { container } = render(<JSONForm fields={fields} adapter={taxiFormAdapter()} onSubmit={submitted} />)

    expect((screen.getByRole('button', { name: /Создать аккаунт/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(/Водитель/))
    fireEvent.change(screen.getByLabelText(/Страна/), { target: { value: 'by' } })
    expect(screen.getByRole('option', { name: 'Минск' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Стаж/), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText(/Имя/), { target: { value: 'Анна' } })
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'anna@example.com' } })
    fireEvent.click(screen.getByLabelText(/Есть реферальный код/))
    fireEvent.change(screen.getByLabelText(/Реферальный код/), { target: { value: 'PARTNER' } })
    fireEvent.change(screen.getByLabelText(/Промокод/), { target: { value: 'SALE10' } })
    fireEvent.change(container.querySelector('input[name="password"]') as HTMLInputElement, { target: { value: 'password1' } })
    fireEvent.change(container.querySelector('input[name="password_confirm"]') as HTMLInputElement, { target: { value: 'password1' } })
    fireEvent.click(screen.getByLabelText(/Принимаю условия/))
    expect((screen.getByRole('button', { name: /Создать аккаунт/ }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Создать аккаунт/ }))

    expect(submitted).toHaveBeenCalledWith(expect.objectContaining({
      ref_code: 'PARTNER',
      promo_code: 'SALE10',
      password: 'password1',
      password_confirm: 'password1',
      u_details: { rate: '3' },
    }))
  })

  it('preserves real form_profile dynamic and nested values on submit', () => {
    window.data = { site_constants: taxiSiteConstantsFixture }
    const submitted = vi.fn()
    const fields = readConfiguredFields('form_profile', [])
    render(<JSONForm
      fields={fields}
      adapter={taxiFormAdapter()}
      defaultValues={{
        u_name: 'Анна',
        u_details: { existing: 'kept', street: 'Старая', region: '77' },
        loyalty_tier: 'gold',
      }}
      onSubmit={submitted}
    />)

    fireEvent.change(screen.getByLabelText(/Улица/), { target: { value: 'Новая' } })
    fireEvent.change(screen.getByLabelText(/Уровень лояльности/), { target: { value: 'platinum' } })
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }))

    expect(submitted).toHaveBeenCalledWith({
      u_name: 'Анна',
      u_details: { existing: 'kept', street: 'Новая', region: '77' },
      loyalty_tier: 'platinum',
      promo_code: '',
    })
  })
})
