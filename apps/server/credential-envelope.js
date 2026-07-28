import crypto from 'node:crypto'

const ALGORITHM = 'RSA-OAEP-256'

export function createCredentialEnvelope() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  return {
    publicDescriptor() {
      return {
        version: 1,
        algorithm: ALGORITHM,
        publicKey,
      }
    },
    decrypt(value) {
      if (value?.version !== 1 || value?.algorithm !== ALGORITHM) {
        throw new Error('Unsupported credential envelope')
      }
      const ciphertext = Buffer.from(String(value.ciphertext || ''), 'base64')
      if (!ciphertext.length || ciphertext.length > 1024) {
        throw new Error('Invalid credential envelope')
      }
      return crypto
        .privateDecrypt(
          {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
          },
          ciphertext
        )
        .toString('utf8')
    },
  }
}
