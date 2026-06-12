const DATA_BASE = '/fable5-data'

function cacheBustedUrl(path, version = '') {
  const suffix = version ? `?v=${encodeURIComponent(version)}` : `?t=${Date.now()}`
  return `${DATA_BASE}/${path}${suffix}`
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

let indexPending = null
const shardCache = new Map()

export function loadFable5Index() {
  if (!indexPending) {
    indexPending = (async () => {
      const res = await fetch(cacheBustedUrl('index.json'), { cache: 'no-store' })
      if (!res.ok) throw new Error(`fable5 index: HTTP ${res.status}`)
      return res.json()
    })().catch((err) => {
      indexPending = null
      throw err
    })
  }
  return indexPending
}

async function loadShard(shard, version = '') {
  const cacheKey = `${version}:${shard.file}`
  if (!shardCache.has(cacheKey)) {
    shardCache.set(
      cacheKey,
      (async () => {
        const res = await fetch(cacheBustedUrl(shard.file, version), { cache: 'no-store' })
        if (!res.ok) throw new Error(`fable5 shard ${shard.file}: HTTP ${res.status}`)
        return res.json()
      })().catch((err) => {
        shardCache.delete(cacheKey)
        throw err
      })
    )
  }
  return shardCache.get(cacheKey)
}

export async function loadFable5Showcases({ start = 0, count = 2 } = {}) {
  const index = await loadFable5Index()
  const selected = (index.shards || []).slice(start, start + count)
  const shards = await Promise.all(selected.map((shard) => loadShard(shard, index.lastFetchedAt || index.updatedAt || '')))
  const items = shards.flat()
  items.sort(
    (a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      showcaseScore(b.metrics) - showcaseScore(a.metrics)
  )
  return { index, items, loadedShards: selected.length }
}
