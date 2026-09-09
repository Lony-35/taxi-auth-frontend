import { describe, expect, it, vi } from 'vitest'
import { AuthStore } from './store'
import { MemoryTokenStorage } from './storage'
import type { AuthService } from './types'
import { UserRole } from './types'

const user = {
  u_id: '1',
  u_name: 'User',
  u_email: 'u@example.com',
  u_role: UserRole.Client,
}
const tokens = { token: 'token', u_hash: 'hash' }

function service(): AuthService {
  return {
    login: vi.fn().mockResolvedValue({ user, tokens }),
    register: vi.fn().mockResolvedValue({
      userId: user.u_id,
      emailStatus: true,
      generatedPassword: null,
      user,
      tokens,
      uploadedFileIds: {},
      carId: null,
    }),
    remindPassword: vi.fn().mockResolvedValue(undefined),
    checkReferralCode: vi.fn().mockResolvedValue({ exists: true }),
    getAuthorizedUser: vi.fn().mockResolvedValue(user),
    logout: vi.fn().mockResolvedValue(undefined),
  }
}

describe('AuthStore', () => {
  it('сохраняет сессию после входа', async () => {
    const storage = new MemoryTokenStorage()
    const store = new AuthStore(service(), storage)
    await store.login({ login: 'u@example.com', password: 'secret', type: 'e-mail' })
    expect(store.getSnapshot()).toMatchObject({ status: 'authenticated', user, tokens })
    expect(storage.read()).toEqual(tokens)
  })

  it('восстанавливает сохранённую сессию', async () => {
    const storage = new MemoryTokenStorage()
    storage.write(tokens)
    const store = new AuthStore(service(), storage)
    await store.initialize()
    expect(store.getSnapshot()).toMatchObject({ status: 'authenticated', user, tokens })
  })
})
