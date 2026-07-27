import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_QUERY =
  '(("GPT-5.6" OR "GPT 5.6" OR "GPT5.6" OR "GPT-5.6 Pro" OR "GPT-5.6 Sol" OR "GPT-5.6 Terra" OR "GPT-5.6 Luna" OR "Sol Ultra") (built OR made OR created OR generated OR coding OR game OR website OR frontend OR agent OR app OR "one shot" OR demo))'
const forwarded = process.argv.slice(2)
const has = (name) => forwarded.includes(`--${name}`)
const args = [
  'scripts/fetch-fable5-x-window.mjs',
  '--archive-key',
  'gpt5-6',
  '--default-query',
  DEFAULT_QUERY,
  ...(has('query-file') ? [] : ['--query-file', 'scripts/gpt56-search-queries.txt']),
  ...forwarded,
]

execFileSync(process.execPath, args, {
  cwd: ROOT,
  stdio: 'inherit',
  timeout: Number(process.env.X_FETCH_TIMEOUT_MS || 60 * 60_000),
  maxBuffer: 32 * 1024 * 1024,
})
