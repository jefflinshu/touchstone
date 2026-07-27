import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const DEFAULT_QUERY =
  '(("iOS app" OR "iPhone app" OR "App Store" OR "TestFlight") ("just launched" OR launched OR released OR shipped OR "now available" OR "is live"))'

const forwarded = process.argv.slice(2)
const has = (name) => forwarded.includes(`--${name}`)
const args = [
  'scripts/fetch-fable5-x-window.mjs',
  '--archive-key',
  'ios-apps',
  '--default-query',
  DEFAULT_QUERY,
  ...(has('query-file') ? [] : ['--query-file', 'scripts/ios-apps-search-queries.txt']),
  ...forwarded,
]

execFileSync(process.execPath, args, {
  cwd: ROOT,
  stdio: 'inherit',
  timeout: Number(process.env.X_FETCH_TIMEOUT_MS || 60 * 60_000),
  maxBuffer: 32 * 1024 * 1024,
})
