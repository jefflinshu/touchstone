import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const WEB_DIR = join(ROOT, 'apps', 'web')
const OUT_DIR = join(WEB_DIR, 'public', 'figma-motion-data')
const ARCHIVE_ROOT = join(ROOT, 'data-archive', 'figma-motion')
const PUBLIC_MEDIA_DIR = join(WEB_DIR, 'public', 'figma-motion-media')
const PUBLIC_AVATAR_DIR = join(WEB_DIR, 'public', 'figma-motion-avatars')
const CHUNK_SIZE = 24
const CATEGORY_ORDER = ['videos', 'design', 'apps', 'agents', 'prompts', 'news', 'research', 'experiments']
const KEYWORDS = [
  'figma motion',
  'timeline',
  'keyframes',
  'agent',
  'prompt',
  'prototype',
  'animation',
  'motion design',
  'open beta',
  'config',
]

let CACHE_ASSETS = true

function usage() {
  console.error(
    'Usage: node scripts/update-figma-motion-showcases.mjs [--input data-archive/figma-motion/<run-id>/window-posts.json | --archive-root data-archive/figma-motion] [--limit N] [--cache-assets 1|0] [--cache-media 1|0] [--cache-from YYYY-MM-DD]'
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

function flag(value, fallback = false) {
  if (value == null) return fallback
  return ['1', 'true', 'yes', 'y'].includes(String(value).trim().toLowerCase())
}

function slugify(input) {
  return (
    String(input || '')
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 54) || 'figma-motion-post'
  )
}

function cleanText(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanLine(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/&amp;/g, '&')
    .replace(/^\s*(?:\d+[.)/-]?|[-*•>]+)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function trimPunctuation(text) {
  return String(text || '').replace(/^[\s"'“”‘’.,:;!-]+|[\s"'“”‘’.,:;!-]+$/g, '').trim()
}

function limitText(text, max = 150) {
  const clean = trimPunctuation(String(text || '').replace(/\s+/g, ' '))
  if (clean.length <= max) return clean
  const sliced = clean.slice(0, max + 1)
  return trimPunctuation(sliced.slice(0, Math.max(sliced.lastIndexOf(' '), max - 24))) + '...'
}

function asiaShanghaiDate(raw) {
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function scoreMetrics(metrics = {}) {
  return (
    Number(metrics.likes || 0) * 3 +
    Number(metrics.reposts || 0) * 6 +
    Number(metrics.replies || 0) * 2 +
    Number(metrics.quotes || 0) * 4 +
    Number(metrics.bookmarks || 0) * 3 +
    Number(metrics.views || 0) / 1000
  )
}

function tierFor(score) {
  if (score >= 12000) return 'A'
  if (score >= 5000) return 'B'
  if (score >= 1600) return 'C'
  return 'D'
}

function mediaKind(post) {
  const media = Array.isArray(post.media) ? post.media : []
  if (media.some((item) => /video|animated/i.test(item.type))) return 'video'
  if (media.length) return 'image'
  return 'text'
}

function informativeSentences(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\r/g, '\n')
    .split(/\n+|(?<=[.!?。！？])\s+/)
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !/^(wow|holy|insane|wild|crazy|unreal|mind blown)\b[!. ]*$/i.test(line))
}

function titleFromSentence(sentence) {
  const line = trimPunctuation(cleanLine(sentence))
    .replace(/^i\s+(?:just\s+)?/i, '')
    .replace(/^we\s+(?:just\s+)?/i, '')
    .replace(/^figma motion\s+(?:just\s+)?/i, '')
  return limitText(line, 78)
}

function titleFromText(text) {
  const clean = cleanText(text)
  const lower = clean.toLowerCase()

  if (/open beta|rolling out|now available|now live|released|launch|config/.test(lower)) {
    return 'Figma Motion launch and beta update'
  }
  if (/agent|ai|prompt|generate|generated|make it move/.test(lower)) return 'Agent-generated Figma Motion workflow'
  if (/timeline|keyframe|keyframes|presets|easing/.test(lower)) return 'Timeline and keyframe workflow in Figma Motion'
  if (/tutorial|guide|walkthrough|how to|tips/.test(lower)) return 'Figma Motion tutorial or workflow guide'
  if (/prototype|interaction|transition|microinteraction/.test(lower)) return 'Interactive prototype animated with Figma Motion'
  if (/app|mobile|dashboard|product|interface|ui/.test(lower)) return 'Product UI motion demo in Figma Motion'
  if (/motion design|animation|animated|video|clip/.test(lower)) return 'Motion design demo made with Figma Motion'

  return titleFromSentence(informativeSentences(text)[0] || clean) || 'Figma Motion post'
}

function categoriesFor(text) {
  const lower = String(text || '').toLowerCase()
  const categories = []
  const add = (category, pattern) => {
    if (pattern.test(lower)) categories.push(category)
  }

  add('videos', /\b(?:motion|animation|animated|video|clip|timeline|keyframe|keyframes|transition|easing|prototype)\b/)
  add('design', /\b(?:figma|design|ui|ux|prototype|interaction|microinteraction|component|layout|interface)\b/)
  add('apps', /\b(?:app|mobile|ios|android|dashboard|saas|product|interface|screen|flow)\b/)
  add('agents', /\b(?:agent|ai|generate|generated|make it move|prompt-to|assistant)\b/)
  add('prompts', /\b(?:prompt|recipe|workflow|tutorial|guide|walkthrough|how to|tips)\b/)
  add('news', /\b(?:config|launch|released|available|open beta|beta|rolling out|announcing|introducing|new feature)\b/)
  add('research', /\b(?:compare|compared|benchmark|review|analysis|tested|vs\b|versus)\b/)

  const unique = [...new Set(categories)].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b))
  return unique.length ? unique : ['experiments']
}

function sceneFor(text) {
  return categoriesFor(text)[0] || 'experiments'
}

function tagsFor(text) {
  const lower = String(text || '').toLowerCase()
  const tags = ['figma-motion', ...categoriesFor(text)]
  if (/timeline/.test(lower)) tags.push('timeline')
  if (/keyframe/.test(lower)) tags.push('keyframes')
  if (/agent|ai/.test(lower)) tags.push('agent')
  if (/prompt/.test(lower)) tags.push('prompt')
  if (/prototype/.test(lower)) tags.push('prototype')
  return [...new Set(tags)].slice(0, 10)
}

function keywordHits(text) {
  const lower = String(text || '').toLowerCase()
  return KEYWORDS.filter((keyword) => lower.includes(keyword))
}

function extractPrompt(text) {
  const raw = String(text || '').trim()
  const match = raw.match(/(?:^|\n|\s)prompt\s*:\s*([“"']?[\s\S]+)$/i)
  if (!match) return ''
  return match[1].replace(/https?:\/\/t\.co\/\S+/g, '').trim()
}

function promptStatus(text) {
  return extractPrompt(text) ? 'prompted' : 'commentary'
}

function hasFigmaMotionMention(text) {
  return /\bfigma\s*motion\b|\bfigmamotion\b|@figma\b.{0,100}\bmotion\b|\bmotion\b.{0,100}@figma\b/i.test(text)
}

function hasMotionEvidence(post) {
  const text = String(post?.text || '')
  const lower = cleanText(text).toLowerCase()
  const media = Array.isArray(post?.media) ? post.media : []
  if (!hasFigmaMotionMention(text)) return false
  if (extractPrompt(text)) return true
  const hasDemoClaim =
    /\b(?:made|created|built|animated|designed|prototype|demo|study|experiment|using|tried|playing with|followed|tutorial|guide|walkthrough|how to|workflow|agent|prompt|keyframe|timeline|export|handoff|plugin)\b/i.test(
      text
    )
  if (media.some((item) => /video|animated/i.test(item.type || '')) && hasDemoClaim) return true
  if (media.length && hasDemoClaim && !isNonCaseImagePost(post)) return true
  return /\b(?:timeline|keyframe|keyframes|presets|easing|motion design|animation|animated|prototype|interaction|transition|microinteraction|agent|ai|generate|generated|tutorial|guide|walkthrough|open beta|launch|released|available|config)\b/.test(
    lower
  )
}

function isNonCaseImagePost(post) {
  const text = String(post?.text || '')
  const lower = cleanText(text).toLowerCase()
  const media = Array.isArray(post?.media) ? post.media : []
  const onlyImages = media.length > 0 && media.every((item) => !/video|animated/i.test(item.type || ''))
  if (!onlyImages) return false
  const strongImageCase =
    (/\b(?:i|we)\b.{0,120}\b(?:created|made|built|animated|designed|tried|trying out|played with|brinquei)\b.{0,120}\b(?:figma\s*motion|@figma\b.{0,40}\bmotion)\b/i.test(text) ||
      /\b(?:figma\s*motion|@figma\b.{0,40}\bmotion)\b.{0,120}\b(?:created|made|built|animated|designed|tried|prototype|plugin|tutorial|guide|walkthrough|followed|作った|制作|試し|作成|生成|プラグイン)\b/i.test(text) ||
      /\b(?:plugin|tutorial|guide|walkthrough|followed|プラグイン)\b/i.test(text)) &&
    !/\b(?:will|would|need to create|going to create|dropping soon|coming soon|recap|roundup|newsletter|news|announced|announcement|launch|released|open beta|config was|room full of creatives|swag|book|under threat|future of|caught my attention|how i feel|reminds me|might end up|may have just|line between design)\b/i.test(text)
  if (!strongImageCase) return true
  if (/\b(?:about last|room full of creatives|conference|config was|swag|handoff|land in|book|newsletter|recap|roundup|news|announced|announcement|launch|released|open beta|new feature|thoughts|take|watching|under threat|future of|just dropped|caught my attention)\b/i.test(text)) {
    return true
  }
  if (/\b(?:framer|flora|fuser|subframe|after effects|adobe|rive)\b/i.test(text) && !/\b(?:i|we)\b.{0,80}\b(?:made|created|built|animated|designed|tried|playing)\b/i.test(text)) {
    return true
  }
  if (/\b(?:hiring|job|newsletter|subscribe|visit to know more|youtube was|recent searches|might end up|may have just|line between design)\b/i.test(lower)) {
    return true
  }
  return false
}

function isLowSignalPost(post) {
  const text = String(post?.text || '')
  const lower = cleanText(text).toLowerCase()
  if (!hasFigmaMotionMention(text)) return true
  if (isNonCaseImagePost(post)) return true
  if (/\b(?:hiring|job|apply now|coupon|giveaway|airdrop|crypto|token)\b/.test(lower)) return true
  if (/\b(?:retweet to win|like and repost|dm me|comment below)\b/.test(lower) && !/\b(?:tutorial|prompt|workflow)\b/.test(lower)) return true
  if (!hasMotionEvidence(post)) return true
  return false
}

function curationDecision(post) {
  if (!post?.url || !post?.author || !post?.text) return { keep: false, reason: 'missing-url-author-or-text' }
  if (isLowSignalPost(post)) return { keep: false, reason: 'low-signal-or-not-figma-motion' }
  return { keep: true, reason: 'figma-motion-evidence' }
}

function actionSummaryFromText(text, media = 'text') {
  const clean = cleanText(text)
  const lower = clean.toLowerCase()
  if (/agent|ai|prompt|generate|generated|make it move/.test(lower)) {
    return 'Shows or discusses an AI-assisted Figma Motion workflow, with the original X post preserved as the source.'
  }
  if (/timeline|keyframe|keyframes|presets|easing/.test(lower)) {
    return 'Shows or explains the Figma Motion timeline and keyframe workflow for animation inside Figma.'
  }
  if (/tutorial|guide|walkthrough|how to|tips/.test(lower)) {
    return 'Shares a Figma Motion tutorial, prompt, or reusable workflow note for motion design.'
  }
  if (/open beta|launch|released|available|config|announcing|introducing/.test(lower)) {
    return 'Covers the Figma Motion launch, beta rollout, or related release details.'
  }
  if (/app|mobile|dashboard|product|ui|interface|prototype/.test(lower)) {
    return 'Shows a product interface or prototype motion demo made around Figma Motion.'
  }
  if (media === 'video') return 'Shows a video-backed Figma Motion demo, with the original X post preserved as the source.'
  const primary = informativeSentences(text).find((line) => line.length > 28) || clean
  return limitText(primary, 165)
}

function summaryFromText(text, media = 'text') {
  return [limitText(actionSummaryFromText(text, media), 165)]
}

function artifactTypeFor(text, media) {
  const lower = String(text || '').toLowerCase()
  if (/tutorial|guide|walkthrough|prompt|recipe/.test(lower)) return 'prompt-pack'
  if (/agent|ai|generate|generated/.test(lower)) return 'agent-workflow'
  if (/app|mobile|dashboard|product|ui|interface/.test(lower)) return 'app'
  if (/timeline|keyframe|prototype|interaction/.test(lower)) return 'prototype'
  if (/launch|released|open beta|config/.test(lower)) return 'news'
  return media === 'video' ? 'video' : media === 'image' ? 'image' : 'case-study'
}

function uniqueMatches(lower, pairs) {
  return pairs.filter(([pattern]) => pattern.test(lower)).map(([, value]) => value)
}

function facetFields(post, media) {
  const text = String(post?.text || post?.originalText || '')
  const lower = text.toLowerCase()
  const capability = uniqueMatches(lower, [
    [/\bagent|ai|generate|generated|prompt-to/, 'agentic-motion'],
    [/\btimeline|keyframe|keyframes|presets|easing/, 'timeline-animation'],
    [/\bprototype|interaction|transition|microinteraction/, 'interaction-design'],
    [/\bapp|mobile|dashboard|product|ui|interface/, 'product-ui'],
    [/\btutorial|guide|walkthrough|tips|prompt/, 'tutorial'],
  ])
  const evidence = []
  if (extractPrompt(text)) evidence.push('prompted')
  if (/tutorial|guide|walkthrough|tips/.test(lower)) evidence.push('tutorial')
  if (/launch|released|open beta|available|config/.test(lower)) evidence.push('official-or-news')
  if (/demo|prototype|made|built|created|animated|generated/.test(lower)) evidence.push('unverified-claim')
  if (!evidence.length) evidence.push('commentary')
  const domain = uniqueMatches(lower, [
    [/\bmobile|ios|android/, 'mobile-design'],
    [/\bdashboard|saas|product/, 'product-design'],
    [/\bcomponent|design system/, 'design-system'],
    [/\bmarketing|landing|website/, 'marketing-design'],
  ])
  return {
    artifactType: artifactTypeFor(text, media),
    medium: media,
    capability: [...new Set(capability)],
    evidence: [...new Set(evidence)],
    domain: [...new Set(domain)],
    tech: ['figma'],
    risk: [],
  }
}

function heat(post) {
  const m = post.metrics || {}
  const likes = Number(m.likes || 0)
  const reposts = Number(m.reposts || 0)
  if (likes || reposts) return `${likes.toLocaleString()} likes · ${reposts.toLocaleString()} reposts`
  return 'X post'
}

function reviewPost(post, decision) {
  return {
    keep: decision.keep,
    reason: decision.reason,
    author: post?.author ? `@${post.author}` : '',
    authorName: post?.authorName || '',
    url: post?.url || '',
    date: asiaShanghaiDate(post?.createdAtISO) || post?.date || '',
    sourceMode: post?.sourceMode || '',
    mediaCount: Array.isArray(post?.media) ? post.media.length : 0,
    metrics: post?.metrics || {},
    text: limitText(post?.text || '', 520),
  }
}

function itemAsPost(item) {
  return {
    url: item?.sourceUrl || '',
    author: String(item?.handle || '').replace(/^@/, '') || item?.author || '',
    authorName: item?.author || '',
    text: item?.originalText || item?.title || '',
    media: Array.isArray(item?.mediaUrls) ? item.mediaUrls.map((url) => ({ url, type: item.media || 'image' })) : [],
  }
}

function loadInputBatches(args) {
  if (args.input) {
    const inputPath = resolve(ROOT, args.input)
    const posts = JSON.parse(readFileSync(inputPath, 'utf8'))
    if (!Array.isArray(posts)) throw new Error(`Expected array in ${inputPath}`)
    return [{ inputPath, sourceRun: basename(dirname(inputPath)), posts }]
  }

  const archiveRoot = resolve(ROOT, args['archive-root'] || ARCHIVE_ROOT)
  if (!existsSync(archiveRoot)) throw new Error(`Archive root does not exist: ${archiveRoot}`)

  const batches = readdirSync(archiveRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const inputPath = join(archiveRoot, entry.name, 'window-posts.json')
      if (!existsSync(inputPath)) return null
      const posts = JSON.parse(readFileSync(inputPath, 'utf8'))
      if (!Array.isArray(posts)) throw new Error(`Expected array in ${inputPath}`)
      return { inputPath, sourceRun: entry.name, posts }
    })
    .filter(Boolean)
    .sort((a, b) => a.sourceRun.localeCompare(b.sourceRun))

  if (!batches.length) throw new Error(`No window-posts.json files found under ${archiveRoot}`)
  return batches
}

function loadExistingItems() {
  const items = []
  try {
    const index = JSON.parse(readFileSync(join(OUT_DIR, 'index.json'), 'utf8'))
    const files = [...(index.pages || []), ...(index.shards || [])].map((entry) => entry.file).filter(Boolean)
    for (const file of [...new Set(files)]) {
      const payload = JSON.parse(readFileSync(join(OUT_DIR, file), 'utf8'))
      if (Array.isArray(payload)) items.push(...payload)
    }
  } catch {}
  return items
}

function cacheMediaPreview(item) {
  if (!CACHE_ASSETS) return item
  const urls = Array.isArray(item.mediaUrls) ? item.mediaUrls : []
  const remoteUrl = item.media === 'video' ? urls.find((url) => /\.mp4(\?|$)/i.test(url)) || urls[0] : urls[0]
  if (!remoteUrl) return item
  mkdirSync(PUBLIC_MEDIA_DIR, { recursive: true })
  const fileName = `${item.id}.jpg`
  const abs = join(PUBLIC_MEDIA_DIR, fileName)
  const publicPath = `/figma-motion-media/${fileName}`
  if (existsSync(abs)) return { ...item, mediaThumbUrl: publicPath }

  const browserCurlArgs = ['-L', '--fail', '--retry', '2', '--retry-delay', '1', '-A', 'Mozilla/5.0']
  const twitterImageCandidates = (url) => {
    if (!/pbs\.twimg\.com\/media\//i.test(url)) return [url]
    const base = url.split('?')[0]
    return [...new Set([`${base}?format=jpg&name=large`, `${base}?format=png&name=large`, url])]
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
          '00:00:00.5',
          '-i',
          remoteUrl,
          '-frames:v',
          '1',
          '-vf',
          'scale=1280:-1:force_original_aspect_ratio=decrease,format=yuvj420p',
          '-q:v',
          '5',
          abs,
        ],
        { cwd: ROOT, timeout: 25_000, stdio: ['ignore', 'ignore', 'pipe'] }
      )
    } else {
      let lastError
      for (const candidate of twitterImageCandidates(remoteUrl)) {
        try {
          execFileSync('curl', [...browserCurlArgs, '--max-time', '30', '-o', abs, candidate], {
            cwd: ROOT,
            stdio: ['ignore', 'ignore', 'pipe'],
          })
          lastError = null
          break
        } catch (error) {
          lastError = error
          rmSync(abs, { force: true })
        }
      }
      if (lastError) throw lastError
    }
    if (existsSync(abs)) return { ...item, mediaThumbUrl: publicPath }
  } catch (error) {
    rmSync(abs, { force: true })
    return { ...item, mediaCacheError: error instanceof Error ? error.message : String(error) }
  }
  return item
}

function cacheAvatar(item, post) {
  if (!CACHE_ASSETS) return item
  const remoteUrl = post.raw?.author?.profileImageUrl || post.authorProfileImageUrl || ''
  if (!remoteUrl) return item
  mkdirSync(PUBLIC_AVATAR_DIR, { recursive: true })
  const fileName = `${item.handle.replace(/^@/, '').toLowerCase()}.jpg`
  const abs = join(PUBLIC_AVATAR_DIR, fileName)
  const publicPath = `/figma-motion-avatars/${fileName}`
  if (existsSync(abs)) return { ...item, avatarUrl: publicPath, sourceAvatarUrl: remoteUrl }
  try {
    execFileSync('curl', ['-L', '--fail', '--max-time', '10', '-o', abs, remoteUrl], {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    if (existsSync(abs)) return { ...item, avatarUrl: publicPath, sourceAvatarUrl: remoteUrl }
  } catch (error) {
    return { ...item, sourceAvatarUrl: remoteUrl, avatarCacheError: error instanceof Error ? error.message : String(error) }
  }
  return { ...item, sourceAvatarUrl: remoteUrl }
}

function toShowcase(post, sourceRun, generatedAt, options = {}) {
  const media = mediaKind(post)
  const status = promptStatus(post.text)
  const item = {
    id: `${post.author}-${slugify(post.id || post.url || post.text)}`,
    title: titleFromText(post.text),
    author: post.authorName || post.author,
    handle: `@${post.author}`,
    sourceUrl: post.url,
    date: asiaShanghaiDate(post.createdAtISO) || post.date || '',
    kind: 'showcase',
    scene: sceneFor(post.text),
    categories: categoriesFor(post.text),
    media,
    heat: heat(post),
    tags: tagsFor(post.text),
    verification: `Fetched from X via twitter-cli from ${post.sourceMode || 'search'}; original author and post URL preserved.`,
    promptStatus: status,
    prompt: extractPrompt(post.text),
    note:
      status === 'prompted'
        ? 'Prompt text was extracted from the original post. Verify the result before treating it as a reusable recipe.'
        : 'Original post did not expose a complete repeatable prompt. Treat this as a source-linked Figma Motion reference.',
    originalText: post.text,
    metrics: post.metrics || {},
    mediaUrls: Array.isArray(post.media) ? post.media.map((entry) => entry.url).filter(Boolean) : [],
    firstSeenAt: generatedAt,
    lastFetchedAt: generatedAt,
    fetchRuns: [sourceRun],
    summary: summaryFromText(post.text, media),
    facets: facetFields(post, media),
  }
  if (!options.cacheMedia) return item
  return cacheAvatar(cacheMediaPreview(item), post)
}

function writeJsonIfChanged(filePath, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`
  try {
    if (readFileSync(filePath, 'utf8') === next) return false
  } catch {}
  writeFileSync(filePath, next)
  return true
}

function cleanupUnreferencedAssets(dir, referencedPaths) {
  if (!existsSync(dir)) return
  const keep = new Set(
    [...referencedPaths]
      .filter(Boolean)
      .map((assetPath) => basename(assetPath))
  )
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    if (!keep.has(entry.name)) rmSync(join(dir, entry.name), { force: true })
  }
}

function sortCategoryCounts(entries) {
  return entries.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a[0])
    const bi = CATEGORY_ORDER.indexOf(b[0])
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    return b[1] - a[1]
  })
}

const args = parseArgs(process.argv.slice(2))
if (args.help || args.h) usage()
const explicitLimit = args.limit != null
const limit = explicitLimit ? Math.max(1, Math.min(Number(args.limit), 5000)) : Number.POSITIVE_INFINITY
const cacheMedia = flag(args['cache-media'], true)
const cacheFrom = String(args['cache-from'] || '')
const reviewLimit = Math.max(1, Math.min(Number(args['review-drops'] || 40), 200))
CACHE_ASSETS = args['cache-assets'] !== '0'

const generatedAt = new Date().toISOString()
const batches = loadInputBatches(args)
const allPosts = batches.flatMap((batch) => batch.posts)
const curationByUrl = new Map()
const candidateByUrl = new Map()

for (const batch of batches) {
  for (const post of batch.posts) {
    const decision = curationDecision(post)
    if (post?.url && !curationByUrl.has(post.url)) curationByUrl.set(post.url, { post: { ...post, sourceRun: batch.sourceRun }, decision })
    if (!decision.keep || !post?.url) continue
    const prev = candidateByUrl.get(post.url)
    const fetchRuns = [...new Set([...(prev?.fetchRuns || []), batch.sourceRun])]
    if (!prev || scoreMetrics(post.metrics || {}) > scoreMetrics(prev.metrics || {})) {
      candidateByUrl.set(post.url, { ...post, fetchRuns, sourceRun: batch.sourceRun })
    } else {
      prev.fetchRuns = fetchRuns
    }
  }
}

const selected = [...candidateByUrl.values()]
  .sort((a, b) => {
    const scoreA = scoreMetrics(a.metrics || {})
    const scoreB = scoreMetrics(b.metrics || {})
    return scoreB - scoreA || String(b.date || '').localeCompare(String(a.date || ''))
  })
  .slice(0, limit)
  .map((post) => {
    const postDay = asiaShanghaiDate(post.createdAtISO) || post.date || ''
    const shouldCacheMedia = cacheMedia && (!cacheFrom || String(postDay) >= cacheFrom)
    const item = toShowcase(post, post.sourceRun, generatedAt, { cacheMedia: shouldCacheMedia })
    item.fetchRuns = post.fetchRuns || item.fetchRuns
    return item
  })

const byUrl = new Map()
for (const item of loadExistingItems()) {
  if (item?.kind === 'search-seed') continue
  if ((item?.fetchRuns || []).includes('manual-seed')) continue
  if (!/^https:\/\/x\.com\//i.test(item?.sourceUrl || '')) continue
  if (item?.sourceUrl && hasFigmaMotionMention(item.originalText || item.title || '')) byUrl.set(item.sourceUrl, item)
}
for (const item of selected) {
  const prev = byUrl.get(item.sourceUrl)
  byUrl.set(item.sourceUrl, {
    ...prev,
    ...item,
    firstSeenAt: prev?.firstSeenAt || item.firstSeenAt,
    lastFetchedAt: generatedAt,
    fetchRuns: [...new Set([...(prev?.fetchRuns || []), ...(item.fetchRuns || [])])],
    mediaThumbUrl: item.mediaThumbUrl || prev?.mediaThumbUrl || '',
  })
}

const collection = [...byUrl.values()]
  .filter((item) => /^https:\/\/x\.com\//i.test(item.sourceUrl || ''))
  .filter((item) => hasFigmaMotionMention(item.originalText || item.title || ''))
  .filter((item) => item.media !== 'text')
  .filter((item) => !isLowSignalPost(itemAsPost(item)))
  .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || scoreMetrics(b.metrics || {}) - scoreMetrics(a.metrics || {}))
  .slice(0, limit)

const creators = new Map()
const keywords = new Map()
for (const post of allPosts) {
  const decision = curationDecision(post)
  if (!decision.keep) continue
  const metrics = post.metrics || {}
  const score = scoreMetrics(metrics)
  const key = post.author
  if (key) {
    const cur = creators.get(key) || {
      handle: `@${post.author}`,
      name: post.authorName || post.author,
      url: `https://x.com/${post.author}`,
      posts: 0,
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: 0,
      bookmarks: 0,
      score: 0,
      topPostUrl: post.url,
      topPostText: post.text,
    }
    cur.posts += 1
    cur.likes += Number(metrics.likes || 0)
    cur.reposts += Number(metrics.reposts || 0)
    cur.replies += Number(metrics.replies || 0)
    cur.quotes += Number(metrics.quotes || 0)
    cur.views += Number(metrics.views || 0)
    cur.bookmarks += Number(metrics.bookmarks || 0)
    if (score > scoreMetrics({ likes: cur.topLikes || 0, reposts: cur.topReposts || 0, replies: cur.topReplies || 0, quotes: cur.topQuotes || 0, bookmarks: cur.topBookmarks || 0, views: cur.topViews || 0 })) {
      cur.topPostUrl = post.url
      cur.topPostText = post.text
      cur.topLikes = Number(metrics.likes || 0)
      cur.topReposts = Number(metrics.reposts || 0)
      cur.topReplies = Number(metrics.replies || 0)
      cur.topQuotes = Number(metrics.quotes || 0)
      cur.topBookmarks = Number(metrics.bookmarks || 0)
      cur.topViews = Number(metrics.views || 0)
    }
    cur.score += score
    creators.set(key, cur)
  }

  for (const keyword of keywordHits(post.text)) {
    const cur = keywords.get(keyword) || { keyword, posts: 0, score: 0, likes: 0, views: 0 }
    cur.posts += 1
    cur.score += score
    cur.likes += Number(metrics.likes || 0)
    cur.views += Number(metrics.views || 0)
    keywords.set(keyword, cur)
  }
}

const creatorPool = [...creators.values()]
  .map((creator) => ({
    ...creator,
    score: Math.round(creator.score),
    tier: tierFor(creator.score),
    topPostText: String(creator.topPostText || '').replace(/\s+/g, ' ').slice(0, 140),
  }))
  .sort((a, b) => b.score - a.score)

const keywordSignals = [...keywords.values()]
  .map((item) => ({ ...item, score: Math.round(item.score), avgScore: Math.round(item.score / item.posts) }))
  .sort((a, b) => b.score - a.score)

mkdirSync(OUT_DIR, { recursive: true })
const CHUNK_DIR = join(OUT_DIR, 'chunks')
const PAGE_DIR = join(OUT_DIR, 'pages')
mkdirSync(CHUNK_DIR, { recursive: true })
mkdirSync(PAGE_DIR, { recursive: true })

const pageList = []
for (let index = 0; index < collection.length; index += CHUNK_SIZE) {
  const page = collection.slice(index, index + CHUNK_SIZE)
  const fileName = `${String(pageList.length).padStart(3, '0')}.json`
  const file = `pages/${fileName}`
  writeJsonIfChanged(join(OUT_DIR, file), page)
  writeJsonIfChanged(join(CHUNK_DIR, fileName), page)
  pageList.push({
    file,
    count: page.length,
    fromDate: page[0]?.date || '',
    toDate: page[page.length - 1]?.date || '',
  })
}

const activePageFiles = new Set(pageList.map((page) => basename(page.file)))
for (const dir of [PAGE_DIR, CHUNK_DIR]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    if (!activePageFiles.has(entry.name)) rmSync(join(dir, entry.name), { force: true })
  }
}

const shardMap = new Map()
for (const item of collection) {
  const day = item.date || String(item.firstSeenAt || '').slice(0, 10) || 'unknown'
  if (!shardMap.has(day)) shardMap.set(day, [])
  shardMap.get(day).push(item)
}
const shardList = [...shardMap.keys()]
  .sort((a, b) => {
    if (a === 'unknown') return 1
    if (b === 'unknown') return -1
    return b.localeCompare(a)
  })
  .map((day) => ({ date: day, file: `${day}.json`, count: shardMap.get(day).length }))
for (const shard of shardList) writeJsonIfChanged(join(OUT_DIR, shard.file), shardMap.get(shard.date))

const categoryCounts = new Map()
for (const item of collection) {
  const categories = Array.isArray(item.categories) && item.categories.length ? item.categories : [item.scene || 'other']
  for (const key of categories) categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1)
}

cleanupUnreferencedAssets(PUBLIC_MEDIA_DIR, collection.map((item) => item.mediaThumbUrl))
cleanupUnreferencedAssets(PUBLIC_AVATAR_DIR, collection.map((item) => item.avatarUrl))

writeJsonIfChanged(join(OUT_DIR, 'creators.json'), { creatorPool, keywordSignals })
writeJsonIfChanged(join(OUT_DIR, 'featured.json'), collection.slice(0, 24))
writeJsonIfChanged(join(OUT_DIR, 'index.json'), {
  updatedAt: generatedAt.slice(0, 10),
  lastFetchedAt: generatedAt,
  cliStatus: `Loaded ${allPosts.length} locally archived X posts from ${batches.length} fetch runs; collection now has ${collection.length} source-linked cards and ${creatorPool.length} creator profiles.`,
  sourceRun: 'local-archive',
  fetchRuns: [...new Set(collection.flatMap((item) => item.fetchRuns || []))],
  total: collection.length,
  categoryCounts: sortCategoryCounts([...categoryCounts.entries()]).map(([key, count]) => ({ key, count })),
  pageSize: CHUNK_SIZE,
  pages: pageList,
  chunks: pageList.map(({ file, count, fromDate, toDate }) => ({ file: file.replace(/^pages\//, 'chunks/'), count, fromDate, toDate })),
  shards: shardList,
})

const finalUrls = new Set(collection.map((item) => item.sourceUrl).filter(Boolean))
const finalReviewEntries = [...curationByUrl.values()].map((entry) => ({
  ...entry,
  decision: finalUrls.has(entry.post.url) ? { keep: true, reason: 'final-collection-kept' } : { keep: false, reason: entry.decision.reason },
}))
writeJsonIfChanged(join(ARCHIVE_ROOT, 'curation-review-latest.json'), {
  generatedAt,
  reviewLimit,
  totals: {
    archivedPosts: allPosts.length,
    uniquePosts: curationByUrl.size,
    kept: finalUrls.size,
    removed: Math.max(0, curationByUrl.size - finalUrls.size),
  },
  removedSamples: finalReviewEntries
    .filter((entry) => !entry.decision.keep)
    .sort((a, b) => scoreMetrics(b.post.metrics || {}) - scoreMetrics(a.post.metrics || {}))
    .slice(0, reviewLimit)
    .map((entry) => reviewPost(entry.post, entry.decision)),
  keptSamples: finalReviewEntries
    .filter((entry) => entry.decision.keep)
    .sort((a, b) => scoreMetrics(b.post.metrics || {}) - scoreMetrics(a.post.metrics || {}))
    .slice(0, reviewLimit)
    .map((entry) => reviewPost(entry.post, entry.decision)),
})

console.log(`Loaded ${allPosts.length} archived Figma Motion posts from ${batches.length} runs`)
console.log(`Merged ${selected.length} local candidates into ${collection.length} total cards and ${creatorPool.length} creators at ${OUT_DIR}`)
