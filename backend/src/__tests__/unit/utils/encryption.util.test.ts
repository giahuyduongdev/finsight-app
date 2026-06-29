import { Env } from '../../../config/env.config'
import { decrypt, encrypt } from '../../../utils/encryption.util'

describe('encryption utility', () => {
  const originalJwtSecret = Env.JWT_SECRET
  const originalEncryptionSecret = Env.ENCRYPTION_SECRET

  afterEach(() => {
    Env.JWT_SECRET = originalJwtSecret
    Env.ENCRYPTION_SECRET = originalEncryptionSecret
  })

  it('keeps ciphertext decryptable when only JWT_SECRET changes', async () => {
    const ciphertext = await encrypt('sensitive-value')

    Env.JWT_SECRET = 'rotated-jwt-secret'

    await expect(decrypt(ciphertext)).resolves.toBe('sensitive-value')
  })

  it('rejects ciphertext after ENCRYPTION_SECRET changes', async () => {
    const ciphertext = await encrypt('sensitive-value')

    Env.ENCRYPTION_SECRET = 'rotated-encryption-secret'

    await expect(decrypt(ciphertext)).rejects.toThrow()
  })
})
