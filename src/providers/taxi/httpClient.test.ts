import { describe, expect, it, vi } from 'vitest'
import { AuthApiError } from '../../auth/errors'
import { HttpAuthClient, normalizeDriverPhone } from './httpClient'
import { UserCheckState, UserRole } from '../../auth/types'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('HttpAuthClient', () => {
  it('нормализует телефон водителя так же, как taxi', () => {
    expect(normalizeDriverPhone('+34 (123) 456-789', '+34')).toBe('+11123456789')
    expect(normalizeDriverPhone('+34 (123) 456-789')).toBe('+34 (123) 456-789')
  })

  it('выполняет двухшаговый вход и нормализует пользователя', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({
        message: 'success',
        auth_hash: 'auth-hash',
        auth_user: {
          u_id: 7,
          u_name: 'Валентин',
          u_email: 'v@example.com',
          u_role: '1',
          u_active: '1',
        },
      }))
      .mockResolvedValueOnce(json({ data: { token: 'token', u_hash: 'user-hash' } }))

    const client = new HttpAuthClient({ baseUrl: 'https://api.example/v1', fetch: fetcher })
    const session = await client.login({
      login: 'v@example.com',
      password: 'secret',
      type: 'e-mail',
    })

    expect(session.tokens).toEqual({ token: 'token', u_hash: 'user-hash' })
    expect(session.user).toMatchObject({ u_id: '7', u_role: 1, u_active: true })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0][0]).toBe('https://api.example/v1/auth')
    expect(fetcher.mock.calls[1][0]).toBe('https://api.example/v1/token')

    const authForm = fetcher.mock.calls[0][1]?.body as FormData
    const tokenForm = fetcher.mock.calls[1][1]?.body as FormData
    expect(authForm.get('login')).toBe('v@example.com')
    expect(authForm.get('au')).toBe('f')
    expect(tokenForm.get('auth_hash')).toBe('auth-hash')
  })

  it('преобразует ответ wrong password в типизированную ошибку', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ message: 'wrong password' }))
    const client = new HttpAuthClient({ baseUrl: 'https://api.example', fetch: fetcher })

    await expect(client.login({ login: 'x', password: 'bad', type: 'e-mail' }))
      .rejects.toMatchObject({ code: 'wrong_password' } satisfies Partial<AuthApiError>)
  })

  it('возвращает данные регистрации и восстанавливает пользователя по токенам', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({
        data: { u_id: 42, email_status: true, token: 't', u_hash: 'h' },
      }))
      .mockResolvedValueOnce(json({
        data: { user: { 42: { u_id: 42, u_name: 'Новый', u_email: 'new@example.com', u_role: 1 } } },
      }))
    const client = new HttpAuthClient({ baseUrl: 'https://api.example', fetch: fetcher })

    const result = await client.register({ u_name: 'Новый', u_email: 'new@example.com' })

    expect(result.userId).toBe('42')
    expect(result.emailStatus).toBe(true)
    expect(result.tokens).toEqual({ token: 't', u_hash: 'h' })
    expect(result.user?.u_name).toBe('Новый')
  })

  it('поддерживает восстановление пароля и проверку промокода', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ status: 'success' }))
      .mockResolvedValueOnce(json({ data: { ref_code_free: false } }))
    const client = new HttpAuthClient({ baseUrl: 'https://api.example', fetch: fetcher })

    await client.remindPassword('user@example.com')
    await expect(client.checkReferralCode('PARTNER')).resolves.toEqual({ exists: true })

    expect(fetcher.mock.calls[0][0]).toBe('https://api.example/remind')
    expect((fetcher.mock.calls[0][1]?.body as FormData).get('u_email')).toBe('user@example.com')
    expect(fetcher.mock.calls[1][0]).toBe('https://api.example/referral/code/PARTNER/check')
    expect(fetcher.mock.calls[1][1]?.method).toBe('GET')
  })

  it('выполняет весь post-register сценарий водителя', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ data: { u_id: 9, token: 't', u_hash: 'h' } }))
      .mockResolvedValueOnce(json({ data: { dl_id: 77 } }))
      .mockResolvedValueOnce(json({ status: 'success' }))
      .mockResolvedValueOnce(json({ data: { created_car: { c_id: 15 } } }))
      .mockResolvedValueOnce(json({ status: 'success' }))
      .mockResolvedValueOnce(json({
        data: { user: { 9: { u_id: 9, u_name: 'Driver', u_email: 'd@example.com', u_role: 2 } } },
      }))
    const client = new HttpAuthClient({
      baseUrl: 'https://api.example',
      fetch: fetcher,
      fileToBase64: vi.fn().mockResolvedValue('data:image/png;base64,AA=='),
    })

    const result = await client.register({
      u_name: 'Driver',
      u_email: 'd@example.com',
      u_role: UserRole.Driver,
      u_details: { street: 'Main' },
      uploads: [{ name: 'passport_photo', file: new Blob(['x'], { type: 'image/png' }) }],
      u_car: { cm_id: '3', seats: 4, registration_plate: 'A1', color: 'red', cc_id: '2' },
      country: 'GHA',
      defaultLocationClassId: '5',
    })

    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      'https://api.example/register',
      'https://api.example/dropbox/file',
      'https://api.example/user',
      'https://api.example/car',
      'https://api.example/car/15',
      'https://api.example/user/authorized',
    ])
    expect(result.uploadedFileIds).toEqual({ passport_photo: ['77'] })
    expect(result.carId).toBe('15')
    expect(result.user?.u_role).toBe(UserRole.Driver)

    const registerForm = fetcher.mock.calls[0][1]?.body as FormData
    expect(registerForm.get('st')).toBe('1')
    expect(registerForm.get('u_role')).toBe('2')
    const uploadForm = fetcher.mock.calls[1][1]?.body as FormData
    expect(uploadForm.get('file')).toContain('data:image/png;base64,AA==')
    const carForm = fetcher.mock.calls[3][1]?.body as FormData
    expect(JSON.parse(String(carForm.get('data')))).toMatchObject({ cm_id: '3', seats: 4 })
  })

  it('редактирует профиль клиента и повторно загружает пользователя', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ status: 'success' }))
      .mockResolvedValueOnce(json({
        data: { user: { 1: { u_id: 1, u_name: 'Новое имя', u_email: 'new@example.com', u_role: 1 } } },
      }))
    const client = new HttpAuthClient({ baseUrl: 'https://api.example', fetch: fetcher })
    const currentUser = { u_id: '1', u_name: 'Старое имя', u_email: 'old@example.com', u_role: UserRole.Client }

    const result = await client.updateProfile(currentUser, {
      values: { u_name: 'Новое имя', u_email: 'new@example.com', u_gps_software: 'excluded' },
    }, { token: 't', u_hash: 'h' })

    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      'https://api.example/user',
      'https://api.example/user/authorized',
    ])
    const editForm = fetcher.mock.calls[0][1]?.body as FormData
    const editData = JSON.parse(String(editForm.get('data')))
    expect(editData).toMatchObject({ u_name: 'Новое имя', u_email: 'new@example.com' })
    expect(editData).not.toHaveProperty('u_gps_software')
    expect(result.user.u_name).toBe('Новое имя')
  })

  it('редактирует автомобиль и документы водителя до проверки', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ data: { ref_code_free: false } }))
      .mockResolvedValueOnce(json({ status: 'success' }))
      .mockResolvedValueOnce(json({ data: { dl_id: 88 } }))
      .mockResolvedValueOnce(json({ status: 'success' }))
      .mockResolvedValueOnce(json({
        data: { user: { 2: { u_id: 2, u_name: 'Driver', u_email: 'd@example.com', u_role: 2, u_check_state: 1 } } },
      }))
    const client = new HttpAuthClient({
      baseUrl: 'https://api.example', fetch: fetcher,
      fileToBase64: vi.fn().mockResolvedValue('data:image/png;base64,AA=='),
    })
    const currentUser = {
      u_id: '2', u_name: 'Driver', u_email: 'd@example.com',
      u_role: UserRole.Driver, u_check_state: UserCheckState.Required, ref_code: 'OLD',
    }

    const result = await client.updateProfile(currentUser, {
      values: { u_name: 'Driver 2', ref_code: 'NEW', u_currency: 'excluded' },
      documents: {
        passport_photo: { existingIds: [10], files: [new Blob(['x'])] },
      },
      car: {
        c_id: '4', cm_id: '3', seats: 4,
        registration_plate: 'A1', color: 'red', cc_id: '2', ignored: true,
      },
    }, { token: 't', u_hash: 'h' })

    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      'https://api.example/referral/code/NEW/check',
      'https://api.example/car/4',
      'https://api.example/dropbox/file',
      'https://api.example/user',
      'https://api.example/user/authorized',
    ])
    expect(result.uploadedFileIds.passport_photo).toEqual(['10', '88'])
    const userForm = fetcher.mock.calls[3][1]?.body as FormData
    const userData = JSON.parse(String(userForm.get('data')))
    expect(userData.u_name).toBe('Driver 2')
    expect(userData).not.toHaveProperty('u_currency')
    expect(userData.u_details).toContainEqual(['=', ['passport_photo'], ['10', '88']])
  })

  it('возвращает понятную ошибку для занятого госномера', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({
      status: 'error',
      message: 'busy registration plate',
    }))
    const client = new HttpAuthClient({ baseUrl: 'https://api.example', fetch: fetcher })

    await expect(client.updateProfile({
      u_id: '2', u_name: 'Driver', u_email: 'd@example.com', u_role: UserRole.Driver,
    }, {
      values: {},
      car: {
        c_id: '4', cm_id: '3', seats: 4,
        registration_plate: 'A1', color: 'red', cc_id: '2',
      },
    }, { token: 't', u_hash: 'h' })).rejects.toMatchObject({
      message: 'Этот госномер уже используется',
    })
  })
})
