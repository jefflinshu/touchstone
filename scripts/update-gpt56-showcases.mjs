import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'apps', 'web', 'public', 'gpt5-6-data')
const PUBLIC_MEDIA_DIR = join(ROOT, 'apps', 'web', 'public', 'gpt5-6-media')
const PUBLIC_AVATAR_DIR = join(ROOT, 'apps', 'web', 'public', 'gpt5-6-avatars')
const GPT_ARCHIVE_ROOT = join(ROOT, 'data-archive', 'gpt5-6')
const FALLBACK_ARCHIVE_ROOT = join(ROOT, 'data-archive', 'fable5')
const PAGE_SIZE = 24
const SOL_PREVIEW_DATE = '2026-06-26'
const GENERAL_AVAILABILITY_DATE = '2026-07-09'
const CATEGORY_ORDER = [
  'games',
  'websites',
  'apps',
  'videos',
  '3d',
  'design',
  'agents',
  'prompts',
  'code',
  'research',
  'experiments',
]
const MODEL_PATTERN = /\b(?:chatgpt[\s-]?)?gpt[\s\-‑]?5(?:\.|[\s\-])?6(?:\s+(?:pro|sol|terra|luna))?\b/i

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : '1'
    args[key] = value
  }
  return args
}

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function cleanText(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function limitText(value, max = 160) {
  const text = cleanText(value)
  if (text.length <= max) return text
  const slice = text.slice(0, max + 1)
  const end = Math.max(slice.lastIndexOf(' '), max - 24)
  return `${slice.slice(0, end).replace(/[\s,;:.-]+$/, '')}...`
}

function scoreMetrics(metrics = {}) {
  return (
    number(metrics.likes) * 3 +
    number(metrics.reposts) * 6 +
    number(metrics.replies) * 2 +
    number(metrics.quotes) * 4 +
    number(metrics.bookmarks) * 3 +
    number(metrics.views) / 1000
  )
}

function mediaKind(post) {
  const media = Array.isArray(post.media) ? post.media : []
  if (media.some((item) => /video|animated/i.test(item.type || ''))) return 'video'
  return media.length || post.mediaVerified === true ? 'image' : 'text'
}

function sourcePlatform(url) {
  if (/^https:\/\/(?:www\.)?(?:x|twitter)\.com\//i.test(url || '')) return 'x'
  if (/^https:\/\/(?:www\.)?reddit\.com\//i.test(url || '')) return 'reddit'
  if (/^https:\/\/(?:www\.)?(?:openai\.com|cdn\.openai\.com)\//i.test(url || '')) return 'openai'
  if (/^https:\/\/(?:www\.)?producthunt\.com\//i.test(url || '')) return 'producthunt'
  return 'web'
}

function releasePhase(date) {
  if (!date) return 'unknown'
  if (date < SOL_PREVIEW_DATE) return 'pre-release'
  if (date < GENERAL_AVAILABILITY_DATE) return 'limited-preview'
  return 'general-availability'
}

function hasDirectModelAttribution(text) {
  const normalized = cleanText(text)
  return (
    /\bgpt[\s\-‑]?5(?:\.|[\s\-])?6(?:\s+(?:pro|sol|terra|luna))?\b.{0,80}\b(?:early coding output|coding output|built|made|created|generated|coded|one[\s-]?shott?ed)\b/i.test(normalized) ||
    /\b(?:built|made|created|generated|coded|shipped|one[\s-]?shott?ed)\b.{0,80}\b(?:with|using|by)\s+(?:chatgpt[\s-]?)?gpt[\s\-‑]?5(?:\.|[\s\-])?6\b/i.test(normalized) ||
    /\bgpt[\s\-‑]?5(?:\.|[\s\-])?6(?:\s+pro)?\b.{0,100}\b(?:continues? to mog|3d test|one[\s-]?shot game builds|frontend capabilities)\b/i.test(normalized) ||
    /\bgpt5\.6の.{0,40}(?:three\.?js|3d).{0,30}デモ/i.test(normalized) ||
    /\bgpt[\s\-‑]?5(?:\.|[\s\-])?6\b.{0,100}\bleaked tests?\b.{0,60}\bone[\s-]?shott?ed\b/i.test(normalized)
  )
}

function isNegativeOrAnticipation(text) {
  const normalized = cleanText(text)
  if (/\b(?:there is no|no need for|without|wasn['’]?t created with|not created with|don['’]?t need|none of it requires)\b.{0,100}\bgpt[\s\-‑]?5(?:\.|[\s\-])?6\b/i.test(normalized)) return true
  if (/\bgpt[\s\-‑]?5(?:\.|[\s\-])?6\b.{0,100}\b(?:coming soon|coming next|expected|rumou?red|unannounced|await|waiting for|can['’]?t wait|will never)\b/i.test(normalized)) return true
  if (/\bgpt[\s\-‑]?5(?:\.|[\s\-])?6\b.{0,30}\b(?:is|are)\s+cooked\b/i.test(normalized)) return true
  if (/\b(?:what i would write|if i was not honest|there is no gpt[\s\-‑]?5(?:\.|[\s\-])?6 yet|built with claude|made with claude|created with opus|using claude|sonnet 5 vs opus|someone needs to make one|won['’]?t be needed|will not be needed|can never compete|yet to be released|possible announcement|suspected gpt[\s\-‑]?5(?:\.|[\s\-])?6|one tester built)\b/i.test(normalized)) return true
  if (/gpt[\s\-‑]?5(?:\.|[\s\-])?6.{0,30}不要/i.test(normalized)) return true
  return false
}

function curationDecision(post, minBookmarks) {
  if (!post?.url || !post?.author || !post?.text) return { keep: false, reason: 'missing-url-author-or-text' }
  const platform = sourcePlatform(post.url)
  if (!['x', 'reddit', 'openai', 'producthunt'].includes(platform)) return { keep: false, reason: 'unsupported-source' }
  if (['reddit', 'openai', 'producthunt'].includes(platform) && post.researchVerified !== true) {
    return { keep: false, reason: `${platform}-source-not-research-verified` }
  }
  if (!MODEL_PATTERN.test(post.text)) return { keep: false, reason: 'no-gpt-5-6-mention' }
  if (mediaKind(post) === 'text') return { keep: false, reason: 'no-media-evidence' }
  if (platform === 'x' && post.researchVerified !== true && number(post.metrics?.bookmarks) < minBookmarks) {
    return { keep: false, reason: 'below-min-bookmarks' }
  }
  if (!['openai', 'producthunt'].includes(platform) && isNegativeOrAnticipation(post.text)) {
    return { keep: false, reason: 'not-made-with-gpt-5-6-or-anticipation' }
  }
  if (!hasDirectModelAttribution(post.text)) return { keep: false, reason: 'no-direct-model-attribution' }
  return { keep: true, reason: 'gpt-5-6-build-with-media' }
}

function categoriesFor(text) {
  const lower = String(text || '').toLowerCase()
  const categories = []
  const add = (category, pattern) => {
    if (pattern.test(lower)) categories.push(category)
  }
  add('games', /\b(?:game|playable|physics|island|rpg|platformer|minecraft)\b/)
  add('websites', /\b(?:website|landing page|frontend|three\.?js|web app|browser)\b/)
  add('apps', /\b(?:app|mobile|dashboard|product|tool|workflow)\b/)
  add('videos', /\b(?:video|animation|animated|motion|cinematic)\b/)
  add('3d', /\b(?:3d|three\.?js|spatial|geometry|model|scene|blender|aircraft|boeing)\b/)
  add('design', /\b(?:design|ui|ux|interface|layout|visual|svg)\b/)
  add('agents', /\b(?:agent|codex|tool use|browser control|workflow)\b/)
  add('prompts', /\b(?:prompt|one[\s-]?shot|recipe|instructions)\b/)
  add('code', /\b(?:code|coding|repository|repo|debug|refactor)\b/)
  add('research', /\b(?:compare|comparison|benchmark|test|versus|vs\b|evaluation)\b/)
  const unique = [...new Set(categories)]
  return unique.length ? unique.sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)) : ['experiments']
}

function titleFromText(text) {
  const lower = cleanText(text).toLowerCase()
  if (/\bboeing|747|aircraft\b/.test(lower) && /\bthree\.?js|3d\b/.test(lower)) return 'Boeing 747 Three.js spatial reasoning test'
  if (/\bgame\b/.test(lower) && /\bone[\s-]?shot|3d|three\.?js\b/.test(lower)) return 'One-shot 3D game generation test'
  if (/\bfrontend|landing page|website\b/.test(lower)) return 'GPT-5.6 frontend generation test'
  if (/\bthree\.?js|3d|spatial|geometry\b/.test(lower)) return 'GPT-5.6 Pro 3D generation test'
  if (/\bcoding output|code|coding\b/.test(lower)) return 'GPT-5.6 coding output'
  return limitText(cleanText(text).split(/(?<=[.!?。！？])\s+/)[0], 82) || 'GPT-5.6 community showcase'
}

function extractPrompt(text) {
  const match = String(text || '').match(/(?:^|\n)\s*prompt\s*:\s*([\s\S]+)$/i)
  return match ? match[1].replace(/https?:\/\/\S+/g, '').trim() : ''
}

function summaryFor(post, media) {
  const categories = categoriesFor(post.text)
  const focus = categories.includes('games')
    ? 'game generation'
    : categories.includes('3d')
      ? '3D and spatial generation'
      : categories.includes('websites')
        ? 'frontend generation'
        : 'coding'
  return [
    `Shows a source-linked GPT-5.6 ${focus} example with ${media === 'video' ? 'video' : 'visual'} evidence preserved from the original source.`,
  ]
}

function itemFromPost(post, generatedAt) {
  const media = mediaKind(post)
  const categories = categoriesFor(post.text)
  const prompt = extractPrompt(post.text)
  const avatarUrl = post.raw?.author?.profileImageUrl || post.authorProfileImageUrl || ''
  const platform = sourcePlatform(post.url)
  const phase = releasePhase(post.date || String(post.createdAtISO || '').slice(0, 10))
  return {
    id: `${post.author}-${post.id || basename(post.url)}`,
    title: post.title || titleFromText(post.text),
    author: post.authorName || post.author,
    handle: `@${post.author}`,
    sourceUrl: post.url,
    date: post.date || String(post.createdAtISO || '').slice(0, 10),
    kind: 'showcase',
    scene: categories[0],
    categories,
    media,
    heat: `${number(post.metrics?.likes).toLocaleString()} likes · ${number(post.metrics?.reposts).toLocaleString()} reposts`,
    tags: [...new Set(['gpt-5.6', phase, ...categories, prompt ? 'prompt' : 'showcase'])].slice(0, 10),
    sourcePlatform: platform,
    releasePhase: phase,
    verification: platform === 'x'
      ? `Fetched from X via ${post.sourceMode || 'search'}; original author and post URL preserved. Model attribution is the source author's claim.`
      : platform === 'openai'
        ? 'First-party OpenAI launch artifact with official release date, attribution, and interactive demo preserved.'
        : platform === 'producthunt'
          ? 'Research-verified from Product Hunt’s official OpenAI Day collection of products built with GPT-5.6; product page and event attribution are preserved.'
          : `Research-verified from the original Reddit post; author, date, source URL, and media evidence are preserved. Model attribution is the source author's claim.`,
    promptStatus: prompt ? 'prompted' : 'commentary',
    prompt,
    note: prompt
      ? 'Prompt text was extracted from the original post. Verify the model attribution and result before reuse.'
      : 'The original post did not expose a complete prompt. Treat model attribution as a source-linked community claim.',
    originalText: post.text,
    metrics: post.metrics || {},
    mediaUrls: (post.media || []).map((item) => item.url).filter(Boolean),
    ...(post.coverMode ? { coverMode: post.coverMode } : {}),
    ...(avatarUrl ? { avatarUrl, sourceAvatarUrl: avatarUrl } : {}),
    firstSeenAt: generatedAt,
    lastFetchedAt: generatedAt,
    fetchRuns: post.fetchRuns || [post.sourceRun],
    summary: summaryFor(post, media),
    facets: {
      artifactType: categories.includes('games') ? 'game' : categories.includes('websites') ? 'website' : media,
      medium: media,
      capability: categories,
      evidence: [
        prompt
          ? 'prompted'
          : ['openai', 'producthunt'].includes(platform)
            ? 'first-party-or-curated-attribution'
            : 'unverified-claim',
        'source-linked-media',
      ],
      domain: categories.filter((category) => ['games', 'websites', 'apps', 'design', '3d'].includes(category)),
      tech: /\bthree\.?js\b/i.test(post.text) ? ['three.js'] : [],
      risk: ['openai', 'producthunt'].includes(platform) ? [] : ['model-attribution-unverified'],
    },
  }
}

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function fallbackCover(item, error = '') {
  mkdirSync(PUBLIC_MEDIA_DIR, { recursive: true })
  const fileName = `${item.id}.svg`
  const absolutePath = join(PUBLIC_MEDIA_DIR, fileName)
  const publicPath = `/gpt5-6-media/${fileName}`
  const words = String(item.title || 'GPT-5.6 community case').split(/\s+/)
  const lines = []
  for (const word of words) {
    const current = lines.at(-1) || ''
    if (!current || `${current} ${word}`.length > 29) lines.push(word)
    else lines[lines.length - 1] = `${current} ${word}`
  }
  const titleLines = lines.slice(0, 4)
  const titleSvg = titleLines
    .map((line, index) => `<tspan x="72" dy="${index ? 58 : 0}">${xmlEscape(line)}</tspan>`)
    .join('')
  writeFileSync(
    absolutePath,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#071411"/>
      <stop offset="0.55" stop-color="#10231d"/>
      <stop offset="1" stop-color="#1d1632"/>
    </linearGradient>
    <radialGradient id="sun" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#74f8d4" stop-opacity="0.96"/>
      <stop offset="1" stop-color="#74f8d4" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="32"/></filter>
  </defs>
  <rect width="1200" height="760" rx="34" fill="url(#bg)"/>
  <circle cx="978" cy="112" r="220" fill="url(#sun)" filter="url(#blur)"/>
  <path d="M760 760C780 520 850 328 1200 178V760Z" fill="#74f8d4" fill-opacity="0.09"/>
  <path d="M838 760C872 536 954 390 1200 306" fill="none" stroke="#74f8d4" stroke-opacity="0.48" stroke-width="2"/>
  <path d="M928 760C946 582 1038 470 1200 422" fill="none" stroke="#c8a8ff" stroke-opacity="0.48" stroke-width="2"/>
  <rect x="72" y="70" width="190" height="42" rx="21" fill="#74f8d4" fill-opacity="0.13" stroke="#74f8d4" stroke-opacity="0.55"/>
  <text x="167" y="98" text-anchor="middle" fill="#a8ffe9" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" font-weight="700">GPT-5.6 CASE</text>
  <text x="72" y="212" fill="#f4fff9" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="50" font-weight="720" letter-spacing="-1.4">${titleSvg}</text>
  <text x="72" y="665" fill="#a8bdb5" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20">${xmlEscape(item.date)} · ${xmlEscape(item.releasePhase)}</text>
  <circle cx="1090" cy="664" r="37" fill="#74f8d4"/>
  <path d="M1075 664h30m-15-15v30" stroke="#071411" stroke-width="5" stroke-linecap="round"/>
</svg>`
  )
  return {
    ...item,
    mediaThumbUrl: publicPath,
    mediaFallback: true,
    ...(error ? { mediaCacheError: error } : {}),
  }
}

function cacheMediaPreview(item) {
  if (item.coverMode === 'generated') return fallbackCover(item)
  const remoteUrl = item.mediaUrls?.[0]
  if (!remoteUrl) return fallbackCover(item, 'No source media URL was available.')
  mkdirSync(PUBLIC_MEDIA_DIR, { recursive: true })
  const fileName = `${item.id}.jpg`
  const absolutePath = join(PUBLIC_MEDIA_DIR, fileName)
  const publicPath = `/gpt5-6-media/${fileName}`
  const fallbackPath = join(PUBLIC_MEDIA_DIR, `${item.id}.svg`)
  if (existsSync(absolutePath)) {
    rmSync(fallbackPath, { force: true })
    return { ...item, mediaThumbUrl: publicPath }
  }
  if (existsSync(fallbackPath) && item.sourcePlatform !== 'producthunt') {
    return { ...item, mediaThumbUrl: `/gpt5-6-media/${item.id}.svg`, mediaFallback: true }
  }

  try {
    if (item.media === 'video' || /\.mp4(\?|$)/i.test(remoteUrl)) {
      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-hide_banner',
          '-loglevel',
          'error',
          '-user_agent',
          'Mozilla/5.0',
          '-ss',
          '00:00:00.8',
          '-i',
          remoteUrl,
          '-frames:v',
          '1',
          '-vf',
          'scale=1280:-1:force_original_aspect_ratio=decrease,format=yuvj420p',
          '-q:v',
          '4',
          absolutePath,
        ],
        { cwd: ROOT, timeout: 60_000, stdio: ['ignore', 'ignore', 'pipe'] }
      )
    } else {
      const candidates = /pbs\.twimg\.com\/media\//i.test(remoteUrl)
        ? [`${remoteUrl.split('?')[0]}?format=jpg&name=large`, remoteUrl]
        : [remoteUrl]
      let downloaded = false
      for (const candidate of candidates) {
        try {
          execFileSync(
            'curl',
            ['-L', '--fail', '--retry', '2', '--max-time', '30', '-A', 'Mozilla/5.0', '-o', absolutePath, candidate],
            { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] }
          )
          downloaded = true
          break
        } catch {
          rmSync(absolutePath, { force: true })
        }
      }
      if (!downloaded) throw new Error('media download failed')
    }
    if (existsSync(absolutePath)) {
      rmSync(fallbackPath, { force: true })
      return { ...item, mediaThumbUrl: publicPath }
    }
  } catch (error) {
    rmSync(absolutePath, { force: true })
    return fallbackCover(item, error instanceof Error ? error.message : String(error))
  }
  return item
}

function cacheAvatar(item, post) {
  const remoteUrl = item.sourceAvatarUrl || post.raw?.author?.profileImageUrl || post.authorProfileImageUrl || ''
  if (!remoteUrl) return item
  mkdirSync(PUBLIC_AVATAR_DIR, { recursive: true })
  const fileName = `${item.handle.replace(/^@/, '').toLowerCase()}.jpg`
  const absolutePath = join(PUBLIC_AVATAR_DIR, fileName)
  const publicPath = `/gpt5-6-avatars/${fileName}`
  if (existsSync(absolutePath)) return { ...item, avatarUrl: publicPath, sourceAvatarUrl: remoteUrl }
  try {
    execFileSync('curl', ['-L', '--fail', '--retry', '2', '--max-time', '20', '-o', absolutePath, remoteUrl], {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    if (existsSync(absolutePath)) return { ...item, avatarUrl: publicPath, sourceAvatarUrl: remoteUrl }
  } catch (error) {
    rmSync(absolutePath, { force: true })
    const { avatarUrl: _failedAvatarUrl, ...withoutBrokenAvatar } = item
    return {
      ...withoutBrokenAvatar,
      sourceAvatarUrl: remoteUrl,
      avatarCacheError: error instanceof Error ? error.message : String(error),
    }
  }
  return item
}

function cacheItemAssets(item, post, enabled) {
  if (!enabled) return item
  return cacheAvatar(cacheMediaPreview(item), post)
}

function loadBatches(args) {
  if (args.input) {
    const inputPath = resolve(ROOT, args.input)
    return [{ sourceRun: basename(dirname(inputPath)), posts: JSON.parse(readFileSync(inputPath, 'utf8')) }]
  }
  const roots = args['archive-root']
    ? [resolve(ROOT, args['archive-root'])]
    : [GPT_ARCHIVE_ROOT, FALLBACK_ARCHIVE_ROOT]
  const batches = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const inputPath = join(root, entry.name, 'window-posts.json')
      if (!existsSync(inputPath)) continue
      const posts = JSON.parse(readFileSync(inputPath, 'utf8'))
      if (!Array.isArray(posts)) throw new Error(`Expected an array in ${inputPath}`)
      batches.push({ sourceRun: entry.name, posts })
    }
  }
  if (!batches.length) throw new Error('No archived GPT-5.6 source posts found')
  return batches
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function removeStaleJson(dir, activeFiles) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.json') && !activeFiles.has(entry.name)) {
      rmSync(join(dir, entry.name), { force: true })
    }
  }
}

const args = parseArgs(process.argv.slice(2))
const minBookmarks = Math.max(0, number(args['min-bookmarks'], 1))
const limit = args.limit ? Math.max(1, number(args.limit, 200)) : Number.POSITIVE_INFINITY
const cacheAssets = args['cache-assets'] !== '0'
const generatedAt = new Date().toISOString()
const batches = loadBatches(args)
const reviewByUrl = new Map()
const candidates = new Map()

for (const batch of batches) {
  for (const rawPost of batch.posts) {
    const post = { ...rawPost, sourceRun: batch.sourceRun }
    const decision = curationDecision(post, minBookmarks)
    if (post.url && !reviewByUrl.has(post.url)) reviewByUrl.set(post.url, { post, decision })
    if (!decision.keep) continue
    const previous = candidates.get(post.url)
    const fetchRuns = [...new Set([...(previous?.fetchRuns || []), batch.sourceRun])]
    if (!previous || scoreMetrics(post.metrics) > scoreMetrics(previous.metrics)) {
      candidates.set(post.url, { ...post, fetchRuns })
    } else {
      previous.fetchRuns = fetchRuns
    }
  }
}

const collection = [...candidates.values()]
  .sort(
    (a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      scoreMetrics(b.metrics) - scoreMetrics(a.metrics)
  )
  .slice(0, limit)
  .map((post) => cacheItemAssets(itemFromPost(post, generatedAt), post, cacheAssets))

mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(GPT_ARCHIVE_ROOT, { recursive: true })
const pageDir = join(OUT_DIR, 'pages')
const chunkDir = join(OUT_DIR, 'chunks')
mkdirSync(pageDir, { recursive: true })
mkdirSync(chunkDir, { recursive: true })

const pages = []
for (let start = 0; start < collection.length; start += PAGE_SIZE) {
  const items = collection.slice(start, start + PAGE_SIZE)
  const fileName = `${String(pages.length).padStart(3, '0')}.json`
  writeJson(join(pageDir, fileName), items)
  writeJson(join(chunkDir, fileName), items)
  pages.push({
    file: `pages/${fileName}`,
    count: items.length,
    fromDate: items[0]?.date || '',
    toDate: items.at(-1)?.date || '',
  })
}
const activePages = new Set(pages.map((page) => basename(page.file)))
removeStaleJson(pageDir, activePages)
removeStaleJson(chunkDir, activePages)

const byDate = new Map()
for (const item of collection) {
  if (!byDate.has(item.date)) byDate.set(item.date, [])
  byDate.get(item.date).push(item)
}
const shards = [...byDate.keys()]
  .sort((a, b) => b.localeCompare(a))
  .map((date) => ({ date, file: `${date}.json`, count: byDate.get(date).length }))
for (const shard of shards) writeJson(join(OUT_DIR, shard.file), byDate.get(shard.date))
const activeShards = new Set(shards.map((shard) => shard.file))
for (const entry of readdirSync(OUT_DIR, { withFileTypes: true })) {
  if (entry.isFile() && /^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name) && !activeShards.has(entry.name)) {
    rmSync(join(OUT_DIR, entry.name), { force: true })
  }
}

const categoryCounts = new Map()
for (const item of collection) {
  for (const category of item.categories) categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1)
}
const creators = [...new Set(collection.map((item) => item.handle))].map((handle) => {
  const items = collection.filter((item) => item.handle === handle)
  const first = items[0]
  return {
    handle,
    name: first?.author || handle,
    url: first?.sourcePlatform === 'reddit'
      ? `https://www.reddit.com/user/${handle.replace(/^@/, '')}`
      : first?.sourcePlatform === 'openai'
        ? 'https://openai.com/'
        : first?.sourcePlatform === 'producthunt'
          ? first.sourceUrl
          : `https://x.com/${handle.replace(/^@/, '')}`,
    posts: items.length,
    score: Math.round(items.reduce((total, item) => total + scoreMetrics(item.metrics), 0)),
  }
})

writeJson(join(OUT_DIR, 'creators.json'), { creatorPool: creators, keywordSignals: [] })
writeJson(join(OUT_DIR, 'featured.json'), collection.slice(0, PAGE_SIZE))
writeJson(join(OUT_DIR, 'index.json'), {
  updatedAt: generatedAt.slice(0, 10),
  lastFetchedAt: generatedAt,
  cliStatus: `Loaded ${batches.reduce((total, batch) => total + batch.posts.length, 0)} archived posts from ${batches.length} runs; curated ${collection.length} source-linked GPT-5.6 cases.`,
  sourceRun: 'local-archive',
  fetchRuns: [...new Set(collection.flatMap((item) => item.fetchRuns))],
  filters: { minBookmarks, requiresMedia: true, requiresDirectModelAttribution: true },
  total: collection.length,
  categoryCounts: [...categoryCounts.entries()]
    .sort((a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]))
    .map(([key, count]) => ({ key, count })),
  pageSize: PAGE_SIZE,
  pages,
  chunks: pages.map((page) => ({ ...page, file: page.file.replace(/^pages\//, 'chunks/') })),
  shards,
})
writeJson(join(GPT_ARCHIVE_ROOT, 'curation-review-latest.json'), {
  generatedAt,
  totals: {
    archivedPosts: batches.reduce((total, batch) => total + batch.posts.length, 0),
    reviewed: reviewByUrl.size,
    kept: collection.length,
  },
  kept: collection.map((item) => ({ url: item.sourceUrl, title: item.title, metrics: item.metrics })),
  removedSamples: [...reviewByUrl.values()]
    .filter((entry) => !entry.decision.keep && MODEL_PATTERN.test(entry.post.text || ''))
    .sort((a, b) => scoreMetrics(b.post.metrics) - scoreMetrics(a.post.metrics))
    .slice(0, 80)
    .map((entry) => ({
      reason: entry.decision.reason,
      url: entry.post.url,
      text: limitText(entry.post.text, 280),
      metrics: entry.post.metrics || {},
    })),
})

console.log(
  `[gpt56:update] loaded ${batches.reduce((total, batch) => total + batch.posts.length, 0)} archived posts from ${batches.length} runs`
)
console.log(`[gpt56:update] wrote ${collection.length} source-linked cases to ${OUT_DIR}`)
