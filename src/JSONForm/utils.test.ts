// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { getCalculation, getConditionResult, getOptions, makeFlat, makeNested, parseVariable } from './utils'
import { readConfiguredFields, withPasswordFields } from '../forms/config'

afterEach(() => { delete window.data })

describe('JSON Form compatibility utilities', () => {
  it('supports every original expression operator and @form variables', () => {
    expect(getConditionResult(2, '=', '2')).toBe(true)
    expect(getConditionResult(2, '!=', 3)).toBe(true)
    expect(getConditionResult(3, '>', 2)).toBe(true)
    expect(getConditionResult(2, '<', 3)).toBe(true)
    expect(getConditionResult(3, '>=', 3)).toBe(true)
    expect(getConditionResult(2, '<=', 3)).toBe(true)
    expect(parseVariable('@form.invalid', { form: { invalid: true } })).toBe(true)
    expect(getCalculation([
      { expression: [['role', '=', 2], ['state', '=', 'active']], result: 'shown' },
    ], { role: 2, state: 'active' })).toBe('shown')
  })

  it('round-trips nested values', () => {
    const nested = { user: { name: 'Анна' }, active: true }
    expect(makeNested(makeFlat(nested))).toEqual(nested)
  })

  it('gets options from window.data without requiring Array.map', () => {
    window.data = { cities: { '1': { ru: 'Москва' }, '2': { ru: 'Казань' } } }
    expect([...getOptions({ name: 'city', type: 'select', options: { path: 'cities' } })]).toEqual([
      { value: '1', labelLang: { ru: 'Москва' } },
      { value: '2', labelLang: { ru: 'Казань' } },
    ])
  })

  it('parses site_constants and adds registration passwords once', () => {
    window.data = { site_constants: { form_register: { value: JSON.stringify({ fields: [{ name: 'email', type: 'email' }, { name: 'send', type: 'submit' }] }) } } }
    const fields = withPasswordFields(readConfiguredFields('form_register', []))
    expect(fields.map(field => field.name)).toEqual(['email', 'password', 'password_confirm', 'send'])
    expect(withPasswordFields(fields)).toEqual(fields)
  })
})
