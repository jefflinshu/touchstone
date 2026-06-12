const DATA_BASE = '/fable5-data'

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
      const res = await fetch(`${DATA_BASE}/index.json`)
      if (!res.ok) throw new Error(`fable5 index: HTTP ${res.status}`)
      return res.json()
    })().catch((err) => {
      indexPending = null
      throw err
    })
  }
  return indexPending
}

async function loadShard(shard) {
  if (!shardCache.has(shard.file)) {
    shardCache.set(
      shard.file,
      (async () => {
        const res = await fetch(`${DATA_BASE}/${shard.file}`)
        if (!res.ok) throw new Error(`fable5 shard ${shard.file}: HTTP ${res.status}`)
        return res.json()
      })().catch((err) => {
        shardCache.delete(shard.file)
        throw err
      })
    )
  }
  return shardCache.get(shard.file)
}

export async function loadFable5Showcases({ start = 0, count = 2 } = {}) {
  const index = await loadFable5Index()
  const selected = (index.shards || []).slice(start, start + count)
  const shards = await Promise.all(selected.map(loadShard))
  const items = shards.flat()
  items.sort(
    (a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      showcaseScore(b.metrics) - showcaseScore(a.metrics)
  )
  return { index, items, loadedShards: selected.length }
}
