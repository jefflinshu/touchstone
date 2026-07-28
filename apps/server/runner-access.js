export function parseRunnerOwners(value = '') {
  return new Set(
    String(value)
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function resolveRunnerAccess(email, ownerList = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase() || null
  const owners = parseRunnerOwners(ownerList)
  return {
    email: normalizedEmail,
    canExecute: Boolean(normalizedEmail && (owners.size === 0 || owners.has(normalizedEmail))),
    restricted: owners.size > 0,
  }
}

export function describeRunner({ email, ownerList = '', label = 'Owner Mac', online = true } = {}) {
  const access = resolveRunnerAccess(email, ownerList)
  return {
    online,
    connected: online,
    canExecute: online && access.canExecute,
    restricted: access.restricted,
    pairingAvailable: false,
    label,
    transport: 'protected-edge-origin',
  }
}
