import assert from 'node:assert/strict'
import test from 'node:test'
import { handleRequest } from './worker.js'

function testEnv(snapshot = { runs: [], views: {}, projectLikes: {}, users: {} }) {
  return {
    LOCAL_ORIGIN: 'https://touchstone-origin.example.com',
    TOUCHSTONE_EDGE_SECRET: 'test-secret',
    ASSETS: {
      async fetch(request) {
        const path = new URL(request.url).pathname
        if (path === '/_edge/runs.json') {
          return Response.json(snapshot, { headers: { 'x-test-source': 'snapshot' } })
        }
        return new Response(`asset:${path}`, { headers: { 'x-test-source': 'assets' } })
      },
    },
  }
}

test('serves static assets without contacting the local runner', async () => {
  let originCalls = 0
  const response = await handleRequest(
    new Request('https://touchstone.example.com/fable5'),
    testEnv(),
    {},
    async () => {
      originCalls += 1
      throw new Error('unexpected origin call')
    }
  )
  assert.equal(await response.text(), 'asset:/fable5')
  assert.equal(originCalls, 0)
})

test('falls back to the public run snapshot while the runner is offline', async () => {
  const response = await handleRequest(
    new Request('https://touchstone.example.com/api/runs'),
    testEnv({ runs: [{ id: 'published' }], views: {}, projectLikes: {}, users: {} }),
    {},
    async () => {
      throw new Error('runner offline')
    }
  )
  assert.equal(response.headers.get('x-test-source'), 'snapshot')
  assert.deepEqual((await response.json()).runs, [{ id: 'published' }])
})

test('treats Cloudflare origin 530 responses as an offline runner', async () => {
  const response = await handleRequest(
    new Request('https://touchstone.example.com/api/runs'),
    testEnv({ runs: [{ id: 'edge-copy' }], views: {}, projectLikes: {}, users: {} }),
    {},
    async () => new Response('origin DNS error', { status: 530 })
  )
  assert.equal(response.headers.get('x-test-source'), 'snapshot')
  assert.deepEqual((await response.json()).runs, [{ id: 'edge-copy' }])
})

test('proxies local APIs with the edge secret when the runner is online', async () => {
  let proxied
  const response = await handleRequest(
    new Request('https://touchstone.example.com/api/agents'),
    testEnv(),
    {},
    async (request) => {
      proxied = request
      return Response.json({ agents: [{ id: 'codex' }] })
    }
  )
  assert.equal(new URL(proxied.url).host, 'touchstone-origin.example.com')
  assert.equal(proxied.headers.get('x-touchstone-edge-secret'), 'test-secret')
  assert.deepEqual((await response.json()).agents, [{ id: 'codex' }])
})

test('keeps the site health endpoint online when the runner is offline', async () => {
  const response = await handleRequest(
    new Request('https://touchstone.example.com/api/health'),
    testEnv(),
    {},
    async () => {
      throw new Error('runner offline')
    }
  )
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'touchstone-edge',
    siteOnline: true,
    runnerOnline: false,
  })
})
