import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const ARCHIVE_ROOT = join(ROOT, 'data-archive', 'fable5')
const TWITTER_BIN = existsSync('/Users/linshu/.local/pipx/venvs/twitter-cli/bin/twitter')
  ? '/Users/linshu/.local/pipx/venvs/twitter-cli/bin/twitter'
  : 'twitter'

const DEFAULT_QUERY =
  '(("Claude Fable 5" OR "Fable 5" OR "claude-fable-5") (prompt OR prompts OR built OR build OR game OR website OR demo OR showcase))'

const OFFICIAL_HANDLES = [
  'ampcode',
  'sqs',
  'beyang',
  'ajkemps',
  'claudeai',
  'cognition',
  'cursor_ai',
  'googledeepmind',
  'geminiapp',
  'genspark_ai',
  'kirodotdev',
  'lovable',
  'manusai',
  'nousresearch',
  'openaidevs',
  'openai',
  'openclaw',
  'perplexity_ai',
  'askperplexity',
  'replit',
  'vercel',
  'v0',
  'xai',
  'grok',
]

function usage() {
  console.error(
    'Usage: node scripts/fetch-fable5-x-window.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--query-file path] [--target 500] [--max 40] [--min-likes 10] [--min-views 0] [--run-id name] [--mode top|latest] [--official-only 0|1] [--handles a,b,c] [--with-replies 1|0] [--max-replies 12] [--seed-tweets url,id] [--seed-search id,url]'
  )
  process.exit(1)
}

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

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function dayAfter(day) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function normalizeHandle(raw) {
  return String(raw || '').replace(/^@/, '').trim().toLowerCase()
}

function flag(value, fallback = false) {
  if (value == null) return fallback
  return ['1', 'true', 'yes', 'y'].includes(String(value).trim().toLowerCase())
}

function toArray(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.tweets)) return payload.tweets
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

function loadQueries(filePath) {
  if (!filePath) return [DEFAULT_QUERY]
  const abs = resolve(ROOT, filePath)
  return readFileSync(abs, 'utf8')
    .split(/\n+/)
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean)
}

function getAuthor(post, fallbackHandle = '') {
  return normalizeHandle(
    post.author?.screenName ||
      post.author?.username ||
      post.author?.handle ||
      post.user?.screenName ||
      post.user?.username ||
      post.username ||
      post.author ||
      fallbackHandle
  )
}

function getId(post) {
  return String(post.id || post.id_str || post.tweetId || post.rest_id || '').trim()
}

function getText(post) {
  return String(post.text || post.fullText || post.full_text || post.content || '').trim()
}

function getCreated(post) {
  const raw = post.createdAtISO || post.created_at || post.createdAt || post.date || ''
  if (!raw) return ''
  const date = new Date(raw)
  if (!Number.isNaN(date.getTime())) return date.toISOString()
  return String(raw)
}

function getMetrics(post) {
  const metrics = post.metrics || {}
  return {
    likes: Number(metrics.likes ?? post.likeCount ?? post.likes ?? post.favorite_count ?? post.favoriteCount ?? 0) || 0,
    reposts: Number(metrics.retweets ?? metrics.reposts ?? post.retweetCount ?? post.retweets ?? post.retweet_count ?? 0) || 0,
    replies: Number(metrics.replies ?? post.replyCount ?? post.replies ?? post.reply_count ?? 0) || 0,
    quotes: Number(metrics.quotes ?? post.quoteCount ?? post.quotes ?? 0) || 0,
    views: Number(metrics.views ?? post.viewCount ?? post.views ?? 0) || 0,
    bookmarks: Number(metrics.bookmarks ?? post.bookmarkCount ?? post.bookmarks ?? 0) || 0,
  }
}

function getMedia(post) {
  const media = post.media || post.extended_entities?.media || post.entities?.media || []
  return Array.isArray(media)
    ? media.map((item) => ({
        type: item.type || item.mediaType || '',
        url: item.media_url_https || item.media_url || item.url || item.preview_image_url || '',
      }))
    : []
}

function runTwitterText(args, timeoutMs = 45_000) {
  return execFileSync(TWITTER_BIN, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    env: twitterEnv(),
  })
}

function launchctlGetenv(key) {
  try {
    return execFileSync('launchctl', ['getenv', key], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim()
  } catch {
    return ''
  }
}

function twitterEnv() {
  const env = { ...process.env }
  env.TWITTER_AUTH_TOKEN ||= launchctlGetenv('TWITTER_AUTH_TOKEN')
  env.TWITTER_CT0 ||= launchctlGetenv('TWITTER_CT0')
  return env
}

function runTwitter(args, timeoutMs = 45_000) {
  const raw = runTwitterText(args, timeoutMs)
  return JSON.parse(raw)
}

const args = parseArgs(process.argv.slice(2))
const from = args.from
const to = args.to
if (!from || !to || !isDate(from) || !isDate(to) || from > to) usage()

const max = Math.max(5, Math.min(Number(args.max ?? 40), 200))
const target = Math.max(5, Math.min(Number(args.target ?? max), 2000))
const minLikes = Math.max(0, Number(args['min-likes'] ?? 10))
const minViews = Math.max(0, Number(args['min-views'] ?? 0))
const mode = args.mode === 'latest' ? 'latest' : 'top'
const officialOnly = flag(args['official-only'], false)
const withReplies = flag(args['with-replies'], true)
const maxReplies = Math.max(0, Math.min(Number(args['max-replies'] ?? 12), 50))
const queries = loadQueries(args['query-file'])
const seedTweets = String(args['seed-tweets'] || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const seedSearches = String(args['seed-search'] || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const requestedHandles = String(args.handles || '')
  .split(',')
  .map(normalizeHandle)
  .filter(Boolean)
const handles = requestedHandles.length ? requestedHandles : OFFICIAL_HANDLES
const untilExclusive = dayAfter(to)
const runId = args['run-id'] || `fable5-${from}-to-${to}`
const outDir = join(ARCHIVE_ROOT, runId)
mkdirSync(outDir, { recursive: true })

function normalizePost(post, fallbackHandle = '') {
  const author = getAuthor(post, fallbackHandle)
  const id = getId(post)
  const text = getText(post)
  if (!author || !id || !text) return null
  const createdAtISO = getCreated(post)
  const url = post.url || post.tweetUrl || `https://x.com/${author}/status/${id}`
  const metrics = getMetrics(post)
  return {
    id,
    author,
    authorName: post.author?.name || post.user?.name || post.name || author,
    url,
    text,
    createdAtISO,
    date: createdAtISO ? createdAtISO.slice(0, 10) : '',
    metrics,
    media: getMedia(post),
    raw: post,
  }
}

function compactLinkedPost(post, fallbackHandle = '') {
  const normalized = normalizePost(post, fallbackHandle)
  if (!normalized) return null
  return {
    id: normalized.id,
    author: normalized.author,
    authorName: normalized.authorName,
    url: normalized.url,
    text: normalized.text,
    createdAtISO: normalized.createdAtISO,
    date: normalized.date,
    metrics: normalized.metrics,
    media: normalized.media,
  }
}

function arrayAt(payload, keys) {
  for (const key of keys) {
    const value = key.split('.').reduce((cur, part) => cur?.[part], payload)
    if (Array.isArray(value)) return value
  }
  return []
}

function enrichPostWithConversation(post) {
  try {
    const payload = runTwitter(['tweet', post.url || post.id, '-n', String(maxReplies), '--json'], 30_000)
    const replies = arrayAt(payload, ['replies', 'comments', 'data.replies', 'tweet.replies'])
      .map((item) => compactLinkedPost(item))
      .filter(Boolean)
    const threadItems = arrayAt(payload, ['thread', 'threadItems', 'conversation', 'tweets', 'data', 'data.thread', 'data.tweets'])
      .map((item) => compactLinkedPost(item, post.author))
      .filter((item) => item && item.id !== post.id)

    return {
      ...post,
      replies,
      threadItems,
      conversationFetchedAt: new Date().toISOString(),
      conversationFetchStatus: 'ok',
    }
  } catch (error) {
    return {
      ...post,
      conversationFetchStatus: 'failed',
      conversationFetchError: error.stderr?.toString?.() || error.message || String(error),
    }
  }
}

function collectSeedConversation(seed, index) {
  try {
    const payload = runTwitter(['tweet', seed, '-n', String(maxReplies), '--json'], 30_000)
    writeFileSync(join(outDir, `seed-tweet-${index + 1}.json`), `${JSON.stringify(payload, null, 2)}\n`)
    const items = arrayAt(payload, ['data', 'thread', 'threadItems', 'conversation', 'tweets', 'data.thread', 'data.tweets'])
      .map((item) => compactLinkedPost(item))
      .filter(Boolean)

    const root = items[0]
    for (const item of items.slice(1)) {
      if (root?.author && item.author === root.author) continue
      collected.push({
        ...item,
        sourceMode: 'seed-conversation',
        sourceParentUrl: root?.url || seed,
        sourceParentAuthor: root?.author || '',
      })
    }
  } catch (error) {
    failed.push({ seed, mode: 'seed-conversation', error: error.stderr?.toString?.() || error.message || String(error) })
  }
}

function collectSeedSearch(seed, index) {
  try {
    const payload = runTwitter(['search', seed, '--type', 'top', '--exclude', 'retweets', '--min-likes', String(minLikes), '-n', String(max), '--json'])
    writeFileSync(join(outDir, `seed-search-${index + 1}.json`), `${JSON.stringify(payload, null, 2)}\n`)
    for (const post of toArray(payload)) {
      const normalized = normalizePost(post)
      if (normalized) collected.push({ ...normalized, sourceMode: 'seed-search', sourceSeed: seed })
    }
  } catch (error) {
    failed.push({ seed, mode: 'seed-search', error: error.stderr?.toString?.() || error.message || String(error) })
  }
}

const collected = []
const failed = []

try {
  runTwitterText(['status'], 20_000)
} catch (error) {
  const message = error.stderr?.toString?.() || error.message || String(error)
  writeFileSync(join(outDir, 'auth-error.txt'), message)
  console.error('[auth] twitter-cli is not authenticated. Set TWITTER_AUTH_TOKEN and TWITTER_CT0, then rerun.')
  console.error(message)
  process.exit(2)
}

if (officialOnly) {
  for (const [index, handle] of handles.entries()) {
    const query = `${DEFAULT_QUERY} from:${handle}`
    console.log(`[${index + 1}/${handles.length}] @${handle}`)
    try {
      const payload = runTwitter([
        'search',
        query,
        '--type',
        mode,
        '--since',
        from,
        '--until',
        untilExclusive,
        '--exclude',
        'retweets',
        '--min-likes',
        String(minLikes),
        '-n',
        String(max),
        '--json',
      ])
      writeFileSync(join(outDir, `${handle}.json`), `${JSON.stringify(payload, null, 2)}\n`)
      for (const post of toArray(payload)) {
        const normalized = normalizePost(post, handle)
        if (normalized) collected.push({ ...normalized, sourceMode: 'official-account' })
      }
    } catch (error) {
      failed.push({ handle, error: error.stderr?.toString?.() || error.message || String(error) })
    }
  }
} else {
  for (const [index, query] of queries.entries()) {
    if (new Map(collected.map((post) => [post.url, post])).size >= target) break
    console.log(`[query ${index + 1}/${queries.length}] ${query}`)
    try {
      const payload = runTwitter([
        'search',
        query,
        '--type',
        mode,
        '--since',
        from,
        '--until',
        untilExclusive,
        '--exclude',
        'retweets',
        '--min-likes',
        String(minLikes),
        '-n',
        String(max),
        '--json',
      ])
      writeFileSync(join(outDir, `search-${index + 1}.json`), `${JSON.stringify(payload, null, 2)}\n`)
      for (const post of toArray(payload)) {
        const normalized = normalizePost(post)
        if (normalized) collected.push({ ...normalized, sourceMode: 'global-search', sourceQuery: query })
      }
    } catch (error) {
      failed.push({ query, mode: 'global-search', error: error.stderr?.toString?.() || error.message || String(error) })
    }
  }
}

seedTweets.forEach(collectSeedConversation)
seedSearches.forEach(collectSeedSearch)

const dedup = new Map()
for (const post of collected) {
  if (minViews && Number(post.metrics?.views || 0) < minViews) continue
  if (!dedup.has(post.url)) dedup.set(post.url, post)
  if (dedup.size >= target) break
}

const posts = [...dedup.values()].sort((a, b) => {
  const scoreA = a.metrics.likes * 3 + a.metrics.reposts * 5 + a.metrics.replies + a.metrics.views / 1000
  const scoreB = b.metrics.likes * 3 + b.metrics.reposts * 5 + b.metrics.replies + b.metrics.views / 1000
  return scoreB - scoreA || b.date.localeCompare(a.date)
})

const enrichedPosts = withReplies ? posts.map(enrichPostWithConversation) : posts

function writeDailyPosts(postsForWindow) {
  const dailyDir = join(outDir, 'daily-posts')
  rmSync(dailyDir, { recursive: true, force: true })
  mkdirSync(dailyDir, { recursive: true })

  const byDay = new Map()
  for (const post of postsForWindow) {
    const day = post.date || String(post.createdAtISO || '').slice(0, 10) || 'unknown'
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day).push(post)
  }

  const shards = [...byDay.keys()]
    .sort()
    .map((day) => {
      const file = `${day}.json`
      writeFileSync(join(dailyDir, file), `${JSON.stringify(byDay.get(day), null, 2)}\n`)
      return { date: day, file: `daily-posts/${file}`, count: byDay.get(day).length }
    })

  writeFileSync(join(outDir, 'daily-index.json'), `${JSON.stringify({ from, to, total: postsForWindow.length, shards }, null, 2)}\n`)
}

const summary = {
  from,
  to,
  mode,
  officialOnly,
  withReplies,
  maxReplies,
  minViews,
  target,
  queries,
  candidates: enrichedPosts.length,
  conversationFetchFailures: enrichedPosts.filter((post) => post.conversationFetchStatus === 'failed').length,
  failedHandles: failed.length,
  generatedAt: new Date().toISOString(),
}

writeFileSync(join(outDir, 'window-posts.json'), `${JSON.stringify(enrichedPosts, null, 2)}\n`)
writeDailyPosts(enrichedPosts)
writeFileSync(join(outDir, 'failed-handles.json'), `${JSON.stringify(failed, null, 2)}\n`)
writeFileSync(join(outDir, 'run-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)

console.log(`Collected Fable 5 candidate posts: ${posts.length}`)
console.log(`Raw archive dir: ${outDir}`)
