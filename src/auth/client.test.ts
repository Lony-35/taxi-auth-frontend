import { describe, expect, it, vi } from 'vitest'
import { AuthApiError } from './errors'
import { HttpAuthClient } from './client'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('HttpAuthClient', () => {
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
})
