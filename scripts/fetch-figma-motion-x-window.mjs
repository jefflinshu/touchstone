import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const DEFAULT_QUERY =
  '(("Figma Motion" OR "FigmaMotion") (motion OR animation OR animated OR timeline OR keyframe OR keyframes OR prototype OR demo OR Agent OR prompt))'

const forwarded = process.argv.slice(2)
const has = (name) => forwarded.includes(`--${name}`)
const args = [
  'scripts/fetch-fable5-x-window.mjs',
  '--archive-key',
  'figma-motion',
  '--default-query',
  DEFAULT_QUERY,
  ...(has('query-file') ? [] : ['--query-file', 'scripts/figma-motion-search-queries.txt']),
  ...forwarded,
]

execFileSync(process.execPath, args, {
  cwd: ROOT,
  stdio: 'inherit',
  timeout: 10 * 60_000,
  maxBuffer: 32 * 1024 * 1024,
})
