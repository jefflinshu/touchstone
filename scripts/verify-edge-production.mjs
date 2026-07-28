import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://touchstone.jefflin.ai'

function assetPathFromHtml(html) {
  const match = html.match(/<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/)
  if (!match) throw new Error('Could not find the built index bundle')
  return match[1]
}

async function fetchOk(pathname) {
  const response = await fetch(new URL(pathname, PUBLIC_BASE_URL), { cache: 'no-store' })
  if (!response.ok) throw new Error(`${pathname} returned HTTP ${response.status}`)
  return response
}

const localIndex = readFileSync(join(ROOT, 'apps', 'web', 'dist', 'index.html'), 'utf8')
const expectedAsset = assetPathFromHtml(localIndex)
const health = await (await fetchOk('/api/health')).json()
if (health.service !== 'touchstone-edge' || !health.siteOnline) {
  throw new Error(`Production is not served by touchstone-edge: ${JSON.stringify(health)}`)
}

const verifyPath = `/__touchstone_verify__/${expectedAsset.split('/').pop()}`
const publicIndex = await (await fetchOk(verifyPath)).text()
const publicAsset = assetPathFromHtml(publicIndex)
if (publicAsset !== expectedAsset) {
  throw new Error(`Production references ${publicAsset}, expected ${expectedAsset}`)
}

const publicRuns = await (await fetchOk('/api/runs')).json()
const leakedRun = publicRuns.runs?.find(
  (run) => run.publishState !== 'published' && run.publishSource !== 'community-api'
)
if (leakedRun) throw new Error(`Production exposed an unpublished run: ${leakedRun.id}`)

console.log(
  JSON.stringify({
    ok: true,
    publicUrl: PUBLIC_BASE_URL,
    bundle: publicAsset,
    edge: health,
    publicRuns: publicRuns.runs?.length || 0,
  })
)
