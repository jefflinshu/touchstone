const DEFAULT_DATA_BASE = '/fable5-data'

function cacheBustedUrl(dataBase, path, version = '') {
  const suffix = version ? `?v=${encodeURIComponent(version)}` : ''
  return `${dataBase}/${path}${suffix}`
}

export function showcaseScore(metrics = {}) {
  return (
    Number(metrics.likes || 0) * 3 +
    Number(metrics.reposts || 0) * 6 +
    Number(metrics.replies || 0) * 2 +
    Number(metrics.quotes || 0) * 4 +
    Number(metrics.bookmarks || 0) * 3 +
    Number(metrics.views || 0) / 1000
  )
}

const indexPendingByBase = new Map()
const shardCache = new Map()

function cacheKey(...parts) {
  return `touchstone:showcase:${parts.join(':')}`
}

function readSessionJson(key) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeSessionJson(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function readCachedShowcases({ dataBase = DEFAULT_DATA_BASE, start = 0, count = 2 } = {}) {
  const index = readSessionJson(cacheKey(dataBase, 'index'))
  if (!index) return null
  const pages = pageListFromIndex(index).slice(start, start + count)
  const version = index.lastFetchedAt || index.updatedAt || ''
  const pagePayloads = pages.map((page) => readSessionJson(cacheKey(dataBase, version, page.file)))
  if (pagePayloads.some((page) => !page)) return null
  const items = pagePayloads.flatMap((page) => (Array.isArray(page) ? page : page.items || []))
  items.sort(
    (a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      showcaseScore(b.metrics) - showcaseScore(a.metrics)
  )
  return { index, items, loadedPages: pages.length, totalPages: pageListFromIndex(index).length }
}

export function loadShowcaseIndex({ dataBase = DEFAULT_DATA_BASE, label = 'showcase' } = {}) {
  if (!indexPendingByBase.has(dataBase)) {
    indexPendingByBase.set(
      dataBase,
      (async () => {
        const sessionKey = cacheKey(dataBase, 'index')
        const res = await fetch(cacheBustedUrl(dataBase, 'index.json', Date.now()), { cache: 'no-cache' })
        if (!res.ok) throw new Error(`${label} index: HTTP ${res.status}`)
        const index = await res.json()
        writeSessionJson(sessionKey, index)
        indexPendingByBase.delete(dataBase)
        return index
      })().catch((err) => {
        const cached = readSessionJson(cacheKey(dataBase, 'index'))
        indexPendingByBase.delete(dataBase)
        if (cached) return cached
        throw err
      })
    )
  }
  return indexPendingByBase.get(dataBase)
}

function pageListFromIndex(index) {
  if (Array.isArray(index.pages) && index.pages.length) return index.pages
  if (Array.isArray(index.chunks) && index.chunks.length) return index.chunks
  return index.shards || []
}

async function loadPage(page, { dataBase = DEFAULT_DATA_BASE, version = '', label = 'showcase' } = {}) {
  const memoryKey = `${dataBase}:${version}:${page.file}`
  const sessionKey = cacheKey(dataBase, version, page.file)
  const cached = readSessionJson(sessionKey)
  if (cached) return cached
  if (!shardCache.has(memoryKey)) {
    shardCache.set(
      memoryKey,
      (async () => {
        const res = await fetch(cacheBustedUrl(dataBase, page.file, version), { cache: 'force-cache' })
        if (!res.ok) throw new Error(`${label} page ${page.file}: HTTP ${res.status}`)
        const pageData = await res.json()
        writeSessionJson(sessionKey, pageData)
        return pageData
      })().catch((err) => {
        shardCache.delete(memoryKey)
        throw err
      })
    )
  }
  return shardCache.get(memoryKey)
}

export async function loadShowcases({ dataBase = DEFAULT_DATA_BASE, label = 'showcase', start = 0, count = 2 } = {}) {
  const index = await loadShowcaseIndex({ dataBase, label })
  const selected = pageListFromIndex(index).slice(start, start + count)
  const version = index.lastFetchedAt || index.updatedAt || ''
  const pages = await Promise.all(selected.map((page) => loadPage(page, { dataBase, version, label })))
  const items = pages.flatMap((page) => (Array.isArray(page) ? page : page.items || []))
  items.sort(
    (a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      showcaseScore(b.metrics) - showcaseScore(a.metrics)
  )
  return { index, items, loadedPages: selected.length, totalPages: pageListFromIndex(index).length }
}

export function loadFable5Index() {
  return loadShowcaseIndex({ dataBase: DEFAULT_DATA_BASE, label: 'fable5' })
}

export async function loadFable5Showcases({ start = 0, count = 2 } = {}) {
  return loadShowcases({ dataBase: DEFAULT_DATA_BASE, label: 'fable5', start, count })
}

export async function loadFable5Featured() {
  return loadFable5Showcases({ start: 0, count: 1 })
}
