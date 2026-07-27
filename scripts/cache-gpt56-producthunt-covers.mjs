import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const INPUT = join(
  ROOT,
  'data-archive',
  'gpt5-6',
  'producthunt-openai-day-2026-07-23',
  'producthunt-400.raw.json'
)
const OUTPUT_DIR = join(ROOT, 'apps', 'web', 'public', 'gpt5-6-media')
const CONCURRENCY = 16
const products = JSON.parse(readFileSync(INPUT, 'utf8'))

mkdirSync(OUTPUT_DIR, { recursive: true })

const jobs = products.map((product, index) => {
  const rank = product.rank || index + 1
  const productSlug = product.url.split('/').filter(Boolean).at(-1)
  const id = `${productSlug}-openai-day-${String(rank).padStart(3, '0')}-${productSlug}`
  return {
    title: product.title,
    url: String(product.imageUrl || '').split('?')[0],
    output: join(OUTPUT_DIR, `${id}.jpg`),
  }
})

let cursor = 0
let downloaded = 0
let cached = 0
let failed = 0

async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++]
    if (existsSync(job.output)) {
      cached += 1
      continue
    }
    try {
      const response = await fetch(job.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 Touchstone GPT-5.6 library' },
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.startsWith('image/')) throw new Error(`Unexpected content type ${contentType}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length < 512) throw new Error(`Image too small: ${bytes.length} bytes`)
      writeFileSync(job.output, bytes)
      downloaded += 1
    } catch (error) {
      failed += 1
      console.warn(`[gpt56:producthunt-covers] ${job.title}: ${error.message}`)
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
console.log(
  `[gpt56:producthunt-covers] ${jobs.length} products: ${downloaded} downloaded, ${cached} cached, ${failed} failed`
)
