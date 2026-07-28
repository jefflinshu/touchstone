import assert from 'node:assert/strict'
import test from 'node:test'
import { edgeProxyAuthorized } from './edge-auth.js'

const env = {
  TOUCHSTONE_EDGE_ORIGIN_HOST: 'touchstone-origin.example.com',
  TOUCHSTONE_EDGE_SECRET: 'shared-secret',
}

test('allows normal local and public hosts', () => {
  assert.equal(edgeProxyAuthorized({ headers: { host: '127.0.0.1:3000' } }, env), true)
  assert.equal(edgeProxyAuthorized({ headers: { host: 'touchstone.example.com' } }, env), true)
})

test('requires the shared secret on the private edge origin', () => {
  assert.equal(edgeProxyAuthorized({ headers: { host: 'touchstone-origin.example.com' } }, env), false)
  assert.equal(
    edgeProxyAuthorized(
      {
        headers: {
          host: 'touchstone-origin.example.com',
          'x-touchstone-edge-secret': 'shared-secret',
        },
      },
      env
    ),
    true
  )
})

test('supports Express request header access', () => {
  const headers = {
    host: 'touchstone-origin.example.com',
    'x-touchstone-edge-secret': 'shared-secret',
  }
  assert.equal(edgeProxyAuthorized({ get: (name) => headers[name.toLowerCase()] }, env), true)
})
