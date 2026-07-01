const DEFAULT_DATA_BASE = '/fable5-data'

function cacheBustedUrl(dataBase, path, version = '') {
  const suffix = version ? `?v=${encodeURIComponent(version)}` : `?t=${Date.now()}`
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

export function loadShowcaseIndex({ dataBase = DEFAULT_DATA_BASE, label = 'showcase' } = {}) {
  if (!indexPendingByBase.has(dataBase)) {
    indexPendingByBase.set(
      dataBase,
      (async () => {
        const res = await fetch(cacheBustedUrl(dataBase, 'index.json'), { cache: 'no-store' })
        if (!res.ok) throw new Error(`${label} index: HTTP ${res.status}`)
        return res.json()
      })().catch((err) => {
        indexPendingByBase.delete(dataBase)
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
  const cacheKey = `${dataBase}:${version}:${page.file}`
  if (!shardCache.has(cacheKey)) {
    shardCache.set(
      cacheKey,
      (async () => {
        const res = await fetch(cacheBustedUrl(dataBase, page.file, version), { cache: 'no-store' })
        if (!res.ok) throw new Error(`${label} page ${page.file}: HTTP ${res.status}`)
        return res.json()
      })().catch((err) => {
        shardCache.delete(cacheKey)
        throw err
      })
    )
  }
  return shardCache.get(cacheKey)
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
