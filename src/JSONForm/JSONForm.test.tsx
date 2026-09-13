// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import JSONForm from './index'
import type { TForm } from './types'

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
    render(<JSONForm fields={fields} onSubmit={submitted} />)

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
})
