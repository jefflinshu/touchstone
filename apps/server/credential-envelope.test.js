import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'
import { createCredentialEnvelope } from './credential-envelope.js'

test('decrypts credentials encrypted with the public descriptor', () => {
  const envelope = createCredentialEnvelope()
  const descriptor = envelope.publicDescriptor()
  const ciphertext = crypto.publicEncrypt(
    {
      key: descriptor.publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from('sk-private-value')
  )

  assert.equal(
    envelope.decrypt({
      version: descriptor.version,
      algorithm: descriptor.algorithm,
      ciphertext: ciphertext.toString('base64'),
    }),
    'sk-private-value'
  )
})

test('rejects unsupported or empty envelopes', () => {
  const envelope = createCredentialEnvelope()
  assert.throws(() => envelope.decrypt({ version: 2 }), /Unsupported/)
  assert.throws(
    () => envelope.decrypt({ version: 1, algorithm: 'RSA-OAEP-256', ciphertext: '' }),
    /Invalid/
  )
})
