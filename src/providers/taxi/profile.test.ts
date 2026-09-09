import { describe, expect, it } from 'vitest'
import { allowedProfileFields, filterFields } from './profile'
import { UserCheckState, UserRole, type TaxiUser } from './types'

const baseUser: TaxiUser = {
  u_id: '1', u_name: 'User', u_email: 'u@example.com', u_role: UserRole.Client,
}

describe('profile field policy from taxi ProfileModal', () => {
  it('разрешает клиентские поля и отбрасывает водительские', () => {
    const result = filterFields(
      { u_name: 'New', u_currency: 'USD', u_gps_software: 'maps' },
      allowedProfileFields(baseUser),
    )
    expect(result).toEqual({ u_name: 'New', u_currency: 'USD' })
  })

  it('до проверки водителя разрешает личные данные, но не рабочие', () => {
    const user = { ...baseUser, u_role: UserRole.Driver, u_check_state: UserCheckState.Required }
    const result = filterFields(
      { u_name: 'Driver', u_city: '1', u_currency: 'USD', out_drive: true },
      allowedProfileFields(user),
    )
    expect(result).toEqual({ u_name: 'Driver', u_city: '1' })
  })

  it('активному водителю разрешает рабочие настройки, но не личные данные', () => {
    const user = { ...baseUser, u_role: UserRole.Driver, u_check_state: UserCheckState.Active }
    const result = filterFields(
      { u_name: 'Blocked', u_currency: 'USD', u_gps_software: 'maps', out_drive: true },
      allowedProfileFields(user),
    )
    expect(result).toEqual({ u_currency: 'USD', u_gps_software: 'maps', out_drive: true })
  })

  it('не разрешает редактирование заблокированному или отклонённому водителю', () => {
    const user = { ...baseUser, u_role: UserRole.Driver, u_check_state: UserCheckState.Blocked }
    expect(allowedProfileFields(user).size).toBe(0)
  })
})
