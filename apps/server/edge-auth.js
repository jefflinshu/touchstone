import crypto from 'node:crypto'

function header(req, name) {
  if (typeof req.get === 'function') return req.get(name)
  return req.headers?.[name.toLowerCase()]
}

export function edgeProxyAuthorized(req, env = process.env) {
  const expectedHost = String(env.TOUCHSTONE_EDGE_ORIGIN_HOST || '').toLowerCase()
  const requestHost = String(header(req, 'host') || '').split(':')[0].toLowerCase()
  if (!expectedHost || requestHost !== expectedHost) return true
  const expected = Buffer.from(String(env.TOUCHSTONE_EDGE_SECRET || ''))
  const received = Buffer.from(String(header(req, 'x-touchstone-edge-secret') || ''))
  return expected.length > 0 && expected.length === received.length && crypto.timingSafeEqual(expected, received)
}
