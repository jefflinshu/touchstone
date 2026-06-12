import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const ARCHIVE_ROOT = join(ROOT, 'data-archive', 'fable5')
const STATE_FILE = join(ARCHIVE_ROOT, 'incremental-state.json')
const QUERY_FILE = join(ROOT, 'scripts', 'fable5-search-queries.txt')
const TEMP_QUERY_FILE = join(ARCHIVE_ROOT, '.incremental-queries.txt')
const CREATORS_FILE = join(ROOT, 'web', 'public', 'fable5-data', 'creators.json')

const CORE_QUERY_INDEXES = [0, 10, 18]
const CREATOR_QUERY =
  '("Fable 5" OR "Claude Fable" OR "Claude Mythos" OR "Mythos 5" OR (Fable (prompt OR built OR game OR website OR demo OR design OR code)) OR (Mythos (prompt OR built OR game OR website OR demo OR design OR code)))'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1'
    args[key] = value
  }
  return args
}

function dayOffset(day, offset) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

function readQueries() {
  return readFileSync(QUERY_FILE, 'utf8')
    .split(/\n+/)
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean)
}

function rotate(items, offset, count) {
  if (!items.length || count <= 0) return []
  const selected = []
  for (let i = 0; i < Math.min(count, items.length); i += 1) {
    selected.push(items[(offset + i) % items.length])
  }
  return selected
}

function selectedQueries(allQueries, offset, batchSize) {
  if (batchSize <= 0) return []
  const core = CORE_QUERY_INDEXES.map((index) => allQueries[index]).filter(Boolean)
  const coreSet = new Set(core)
  const rotatingPool = allQueries.filter((query) => !coreSet.has(query))
  const rotatingCount = Math.max(0, batchSize - core.length)
  return [...core, ...rotate(rotatingPool, offset, rotatingCount)]
}

function selectedCreators(offset, batchSize) {
  if (!existsSync(CREATORS_FILE) || batchSize <= 0) return []
  const data = readJson(CREATORS_FILE, {})
  const handles = (data.creatorPool || [])
    .map((creator) => String(creator.handle || '').replace(/^@/, '').trim().toLowerCase())
    .filter(Boolean)
    .filter((handle) => !['claudeai'].includes(handle))
  return rotate([...new Set(handles)].slice(0, 80), offset, batchSize)
}

function runNode(args) {
  console.log(`$ node ${args.join(' ')}`)
  execFileSync(process.execPath, args, {
    cwd: ROOT,
    stdio: 'inherit',
    timeout: 10 * 60_000,
    maxBuffer: 32 * 1024 * 1024,
  })
}

function writeTempQueries(queries) {
  mkdirSync(ARCHIVE_ROOT, { recursive: true })
  writeFileSync(TEMP_QUERY_FILE, `${queries.join('\n')}\n`)
  return TEMP_QUERY_FILE
}

const args = parseArgs(process.argv.slice(2))
const today = args.date || new Date().toISOString().slice(0, 10)
const lookbackDays = Math.max(0, Number(args['lookback-days'] ?? 1))
const from = args.from || dayOffset(today, -lookbackDays)
const to = args.to || today
const queryBatchSize = Math.max(0, Number(args['query-batch-size'] ?? 5))
const creatorBatchSize = Math.max(0, Number(args['creator-batch-size'] ?? 6))
const max = Math.max(5, Math.min(Number(args.max ?? 35), 100))
const target = Math.max(5, Math.min(Number(args.target ?? 120), 500))
const minLikes = Math.max(0, Number(args['min-likes'] ?? 0))
const updateLimit = args['update-limit'] == null ? '' : String(Math.max(1, Math.min(Number(args['update-limit']), 5000)))
const mode = args.mode === 'top' ? 'top' : 'latest'
const skipCreatorFetch = args['skip-creators'] === '1'
const cacheAssets = args['cache-assets'] === '0' ? '0' : '1'

const state = readJson(STATE_FILE, { queryOffset: 0, creatorOffset: 0, runs: [] })
const allQueries = readQueries()
const queries = selectedQueries(allQueries, Number(state.queryOffset || 0), queryBatchSize)
const creators = skipCreatorFetch ? [] : selectedCreators(Number(state.creatorOffset || 0), creatorBatchSize)
const stamp = `${from}-to-${to}`

if (queries.length) {
  const queryFile = writeTempQueries(queries)
  runNode([
    'scripts/fetch-fable5-x-window.mjs',
    '--from',
    from,
    '--to',
    to,
    '--query-file',
    queryFile,
    '--target',
    String(target),
    '--max',
    String(max),
    '--min-likes',
    String(minLikes),
    '--mode',
    mode,
    '--with-replies',
    '0',
    '--run-id',
    `incremental-${stamp}-q${state.queryOffset || 0}`,
  ])
}

if (creators.length) {
  runNode([
    'scripts/fetch-fable5-x-window.mjs',
    '--from',
    from,
    '--to',
    to,
    '--official-only',
    '1',
    '--handles',
    creators.join(','),
    '--handle-query',
    CREATOR_QUERY,
    '--target',
    String(Math.max(target, creators.length * max)),
    '--max',
    String(Math.min(max, 30)),
    '--min-likes',
    String(minLikes),
    '--mode',
    mode,
    '--with-replies',
    '0',
    '--run-id',
    `incremental-${stamp}-creators${state.creatorOffset || 0}`,
  ])
}

runNode([
  'scripts/update-fable5-showcases.mjs',
  ...(updateLimit ? ['--limit', updateLimit] : []),
  '--cache-assets',
  cacheAssets,
])

const nextState = {
  ...state,
  queryOffset: allQueries.length ? (Number(state.queryOffset || 0) + Math.max(0, queryBatchSize - CORE_QUERY_INDEXES.length)) % Math.max(1, allQueries.length - CORE_QUERY_INDEXES.length) : 0,
  creatorOffset: Number(state.creatorOffset || 0) + creators.length,
  lastRunAt: new Date().toISOString(),
  lastWindow: { from, to },
  lastSelection: { queries, creators },
  runs: [
    ...(state.runs || []).slice(-20),
    {
      at: new Date().toISOString(),
      from,
      to,
      queryCount: queries.length,
      creators,
      mode,
      max,
      target,
    },
  ],
}
writeFileSync(STATE_FILE, `${JSON.stringify(nextState, null, 2)}\n`)
console.log(`Incremental Fable 5 update complete: ${queries.length} query searches, ${creators.length} creator searches.`)
