const DEFAULT_ORIGIN_TIMEOUT_MS = 4_000
const SNAPSHOT_PATH = '/_edge/runs.json'

function json(data, init = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers })
}

function isUnavailable(response) {
  return response.status >= 500
}

function originUrl(request, env) {
  const incoming = new URL(request.url)
  const target = new URL(env.LOCAL_ORIGIN)
  target.pathname = incoming.pathname
  target.search = incoming.search
  return target
}

async function fetchOrigin(request, env, fetchImpl, timeoutMs = DEFAULT_ORIGIN_TIMEOUT_MS) {
  const headers = new Headers(request.headers)
  headers.set('x-touchstone-edge-secret', env.TOUCHSTONE_EDGE_SECRET || '')
  headers.set('x-forwarded-host', new URL(request.url).host)
  headers.set('x-forwarded-proto', 'https')

  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    init.duplex = 'half'
  }

  const isWebSocket = headers.get('upgrade')?.toLowerCase() === 'websocket'
  if (isWebSocket) return fetchImpl(new Request(originUrl(request, env), init))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('origin timeout'), timeoutMs)
  try {
    return await fetchImpl(new Request(originUrl(request, env), { ...init, signal: controller.signal }))
  } finally {
    clearTimeout(timer)
  }
}

async function assetResponse(env, request, pathname = null) {
  if (!pathname) return env.ASSETS.fetch(request)
  const url = new URL(request.url)
  url.pathname = pathname
  url.search = ''
  return env.ASSETS.fetch(new Request(url, request))
}

async function runsWithFallback(request, env, fetchImpl) {
  try {
    const response = await fetchOrigin(request, env, fetchImpl)
    if (!isUnavailable(response)) return response
  } catch {}
  return assetResponse(env, request, SNAPSHOT_PATH)
}

async function workspaceWithFallback(request, env, fetchImpl) {
  try {
    const response = await fetchOrigin(request, env, fetchImpl)
    if (response.ok || !isUnavailable(response)) return response
  } catch {}
  return assetResponse(env, request)
}

async function apiWithOfflineFallback(request, env, fetchImpl) {
  const { pathname } = new URL(request.url)
  try {
    const response = await fetchOrigin(request, env, fetchImpl)
    if (!isUnavailable(response)) return response
  } catch {}

  if (pathname === '/api/auth/me') {
    return json({ loggedIn: false, email: null, runnerOnline: false })
  }
  if (pathname === '/api/agents') {
    return json({
      agents: [],
      defaults: {},
      runnerOnline: false,
      runner: {
        online: false,
        connected: false,
        canExecute: false,
        restricted: true,
        pairingAvailable: false,
        label: 'Owner Mac',
        transport: 'protected-edge-origin',
      },
    })
  }
  return json(
    {
      error: '本地执行器当前离线。网站仍可浏览；请启动 Touchstone Companion 后再执行本地任务。',
      code: 'LOCAL_RUNNER_OFFLINE',
    },
    { status: 503 }
  )
}

export async function handleRequest(request, env, _ctx, fetchImpl = fetch) {
  const url = new URL(request.url)

  if (url.pathname === '/api/health') {
    let runnerOnline = false
    try {
      const healthRequest = new Request(new URL('/api/health', request.url), {
        headers: request.headers,
      })
      const response = await fetchOrigin(healthRequest, env, fetchImpl, 1_500)
      runnerOnline = response.ok
    } catch {}
    return json({
      ok: true,
      service: 'touchstone-edge',
      siteOnline: true,
      runnerOnline,
    })
  }

  if (url.pathname === '/api/runs' && request.method === 'GET') {
    return runsWithFallback(request, env, fetchImpl)
  }

  if (url.pathname === '/ws') {
    try {
      return await fetchOrigin(request, env, fetchImpl)
    } catch {
      return new Response('Local runner offline', { status: 503 })
    }
  }

  if (url.pathname.startsWith('/workspace/') || url.pathname.startsWith('/avatars/')) {
    return workspaceWithFallback(request, env, fetchImpl)
  }

  if (url.pathname.startsWith('/api/')) {
    return apiWithOfflineFallback(request, env, fetchImpl)
  }

  return env.ASSETS.fetch(request)
}

export default {
  fetch(request, env, ctx) {
    return handleRequest(request, env, ctx)
  },
}
