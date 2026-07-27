import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const WEB_DIR = join(ROOT, 'apps', 'web')
const OUT_DIR = join(WEB_DIR, 'public', 'ios-apps-data')
const ARCHIVE_ROOT = join(ROOT, 'data-archive', 'ios-apps')
const PUBLIC_MEDIA_DIR = join(WEB_DIR, 'public', 'ios-apps-media')
const PUBLIC_AVATAR_DIR = join(WEB_DIR, 'public', 'ios-apps-avatars')
const CHUNK_SIZE = 24
const CATEGORY_ORDER = [
  'design',
  'ios',
  'icons',
  'resources',
  'motion',
  'productivity',
  'utilities',
  'health',
  'finance',
  'education',
  'creative',
  'social',
  'devtools',
  'games',
  'app-store',
  'testflight',
  'news',
  'experiments',
]
const KEYWORDS = [
  'design',
  'ui',
  'ux',
  'figma',
  'icon',
  'animation',
  'interaction',
  'component',
  'shader',
  'lottie',
  'ios app',
  'iphone app',
  'app store',
  'testflight',
  'swiftui',
  'swift app',
  'indie app',
  'launched',
  'released',
  'shipped',
  'now available',
]

let CACHE_ASSETS = true

function usage() {
  console.error(
    'Usage: node scripts/update-ios-app-showcases.mjs [--input data-archive/ios-apps/<run-id>/window-posts.json | --archive-root data-archive/ios-apps] [--limit N] [--min-bookmarks N] [--cache-assets 1|0] [--cache-media 1|0] [--cache-from YYYY-MM-DD]'
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

function nonNegativeNumber(value, fallback = 0) {
  const numeric = Number(value ?? fallback)
  return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback
}

function slugify(input) {
  return (
    String(input || '')
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 54) || 'ios-app-post'
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
  return `${trimPunctuation(sliced.slice(0, Math.max(sliced.lastIndexOf(' '), max - 24)))}...`
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

function bookmarkCount(metrics = {}) {
  return Number(metrics.bookmarks || 0)
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
    .filter((line) => !/^(wow|holy|insane|wild|crazy|unreal|finally)\b[!. ]*$/i.test(line))
}

function titleFromSentence(sentence) {
  const line = trimPunctuation(cleanLine(sentence))
    .replace(/^i\s+(?:just\s+)?/i, '')
    .replace(/^we\s+(?:just\s+)?/i, '')
    .replace(/^introducing\s+/i, '')
    .replace(/^launching\s+/i, '')
  return limitText(line, 78)
}

function appNameFromText(text) {
  const clean = cleanText(text)
  const patterns = [
    /\b([A-Z][A-Za-z0-9 .&'-]{2,42}?)\s+(?:just\s+)?(?:released|launched|shipped)\s+(?:an?\s+)?(?:native\s+)?(?:iOS|iPhone|iPad|mobile)\s+[Aa]pp\b/,
    /\b([A-Z][A-Za-z0-9 .&'-]{2,42}?)\s+(?:just\s+)?(?:released|launched|shipped)\s+(?:its\s+own\s+|its\s+native\s+|an?\s+native\s+)?(?:iOS|iPhone|iPad)\s+[Aa]pp\b/,
    /\b(?:the\s+)?([A-Z][A-Za-z0-9 .&'-]{2,42}?)\s+(?:iOS|iPhone|iPad)\s+[Aa]pp\s+(?:just\s+)?(?:released|launched|shipped)\b/,
    /\b([A-Z][A-Za-z0-9 .&'-]{2,42}?)\s+(?:just\s+)?(?:launched|released|shipped)\s+on\s+(?:iOS|iPhone|iPad|the\s+App\s+Store)\b/,
    /\b([A-Z][A-Za-z0-9 .&'-]{2,42}?)\s+is\s+now\s+(?:live|available)\s+(?:on|in)\s+the\s+App\s+Store\b/,
    /\b(?:introducing|launching|released|shipped)\s+["“]?([A-Z][A-Za-z0-9 .&'-]{2,42}?)["”]?(?:\s*[-:,.]|\s+for\s+iPhone|\s+on\s+the\s+App\s+Store|\s+is\b)/,
    /\b([A-Z][A-Za-z0-9 .&'-]{2,42}?)\s+is\s+(?:now\s+)?(?:live|available)\s+(?:on|in)\s+the\s+App\s+Store\b/,
    /\bmy\s+new\s+iOS\s+app\s+["“]?([A-Z][A-Za-z0-9 .&'-]{2,42}?)["”]?/,
  ]
  for (const pattern of patterns) {
    const match = clean.match(pattern)
    const candidate = trimPunctuation(match?.[1] || '')
      .replace(/^(?:wait[.\s]*|the\s+|update\s+|im\s+|i'?m\s+)/i, '')
      .replace(/\s+(?:just|actually|officially)$/i, '')
      .trim()
    if (candidate && !/\b(?:app|ios|iphone|ipad|store|testflight|today|finally|just|users|people|android)\b/i.test(candidate)) return candidate
  }
  return ''
}

function normalizedTextKey(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/\bhttps?:\/\/\S+/g, '')
    .replace(/\b(?:ios|iphone|ipad|android|app|apps|store|download|available|launched|released|shipped|today|now|live)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

function dedupeKeyForText(text) {
  const appName = appNameFromText(text)
  if (appName) return `app:${appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const key = normalizedTextKey(text)
  return key ? `text:${key}` : ''
}

function titleFromText(text) {
  const clean = cleanText(text)
  const lower = clean.toLowerCase()
  const appName = appNameFromText(text)
  if (appName) {
    if (/testflight|beta/.test(lower)) return `${appName} iOS beta`
    return `${appName} iOS launch`
  }
  if (/testflight|beta/.test(lower)) return 'New iOS app beta on TestFlight'
  if (/app store|apps\.apple\.com|now available|now live|launched|released|shipped/.test(lower)) return 'New iOS app launch'
  if (/swiftui|swift app/.test(lower)) return 'SwiftUI app shipped for iPhone'
  if (/icons?|iconly|lucide|pikaicons?|nucleo|iconsax|originkit/.test(lower)) return 'Design icon resource'
  if (/redesign|screens|ui|ux|interface|design|figma|prototype|concept/.test(lower)) return 'Product design reference'
  return titleFromSentence(informativeSentences(text)[0] || clean) || 'Design reference'
}

function categoriesFor(text) {
  const lower = String(text || '').toLowerCase()
  const categories = []
  const add = (category, pattern) => {
    if (pattern.test(lower)) categories.push(category)
  }

  add('productivity', /\b(?:productivity|tasks?|todo|calendar|notes?|planner|focus|habit|journal|timer|email|inbox)\b/)
  add('utilities', /\b(?:utility|utilities|widget|keyboard|scanner|ocr|weather|calculator|converter|shortcut|lock screen)\b/)
  add('health', /\b(?:health|fitness|workout|sleep|meditation|mental|nutrition|wellness|period|cycle)\b/)
  add('finance', /\b(?:finance|budget|expense|money|invest|portfolio|crypto|invoice|receipt)\b/)
  add('education', /\b(?:learn|language|course|study|flashcard|school|student|education|reading)\b/)
  add('creative', /\b(?:photo|video|camera|music|audio|design|draw|drawing|illustration|writing|creator|edit|editor|shader|p5js|creative coding)\b/)
  add('social', /\b(?:social|community|dating|friends|chat|message|sharing)\b/)
  add('devtools', /\b(?:developer|devtool|github|api|debug|server|terminal|xcode|swiftui|swift)\b/)
  add('games', /\b(?:game|puzzle|arcade|wordle|rpg|play)\b/)
  add(
    'design',
    /\b(?:ui|ux|design|redesign|screens?|interface|figma|mockup|prototype|product design|mobile design|app design|dynamic island|material|component|components|website|portfolio|hero page|illustration|gradient|border beam|rebrand)\b/
  )
  add('ios', /\b(?:ios|iphone|ipad|swiftui|swift app|app store|testflight)\b|apps\.apple\.com|testflight\.apple\.com/)
  add('icons', /\b(?:icons?|iconly|lucide|pikaicons?|nucleo|iconsax|originkit)\b/)
  add('resources', /\b(?:resources?|toolkit|library|kit|templates?|components?|assets?|free|open source|oss|iconly|lucide|pikaicons?|nucleo|iconsax|originkit)\b/)
  add('motion', /\b(?:motion|animation|animated|interaction|prototype|transition|microinteraction|micro interactions|lottie|shader|shaders|p5js|effect)\b/)
  add('app-store', /\b(?:app store|apps\.apple\.com|download)\b/)
  add('testflight', /\b(?:testflight|beta)\b/)
  add('news', /\b(?:launch|launched|released|shipped|now available|now live|introducing)\b/)

  const unique = [...new Set(categories)].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b))
  return unique.length ? unique : ['experiments']
}

function sceneFor(text) {
  return categoriesFor(text)[0] || 'experiments'
}

function tagsFor(text) {
  const lower = String(text || '').toLowerCase()
  const tags = ['design', ...categoriesFor(text)]
  if (/app store|apps\.apple\.com/.test(lower)) tags.push('app-store')
  if (/testflight|beta/.test(lower)) tags.push('testflight')
  if (/swiftui/.test(lower)) tags.push('swiftui')
  if (/swift\b/.test(lower)) tags.push('swift')
  if (/iphone/.test(lower)) tags.push('iphone')
  return [...new Set(tags)].slice(0, 10)
}

function keywordHits(text) {
  const lower = String(text || '').toLowerCase()
  return KEYWORDS.filter((keyword) => lower.includes(keyword))
}

function extractPrompt() {
  return ''
}

function promptStatus() {
  return 'commentary'
}

function isManualSeedRun(value) {
  return /\bmanual[-_]/i.test(String(value || '')) || String(value || '').includes('recent-design')
}

function isManualSeedPost(post) {
  return isManualSeedRun(post?.sourceRun) || isManualSeedRun(post?.sourceSeed)
}

function isManualSeedItem(item) {
  return (item?.fetchRuns || []).some(isManualSeedRun)
}

function hasIosAppMention(text) {
  return /\b(?:ios|iphone|ipad|swiftui|swift app|app store|testflight)\b|apps\.apple\.com|testflight\.apple\.com/i.test(text)
}

function hasDesignOrIosMention(text) {
  return (
    hasIosAppMention(text) ||
    /\b(?:design(?:ed)?|redesign(?:ed)?|ui|ux|screens?|mockups?|prototype|concept|interface|interaction|figma|product design|mobile design|app design|icons?|iconly|lucide|pikaicons?|nucleo|iconsax|originkit|components?|design system|styleguide|dynamic island|material|shader|shaders|lottie|animation|animated|micro interactions?|hero page|website|portfolio|illustrations?|gradient|border beam|rebrand|p5js|creative coding)\b/i.test(text)
  )
}

function hasReleaseSignal(text) {
  return /\b(?:launch(?:ed|ing)?|released?|shipped?|now available|now live|just dropped|introducing|download|try it|beta|testflight|apps\.apple\.com|testflight\.apple\.com)\b/i.test(text)
}

function hasDesignSignal(text) {
  return /\b(?:design(?:ed)?|redesign(?:ed)?|ui|ux|screens?|mockups?|prototype|concept|interface|interaction|figma|product design|mobile design|app design|icons?|iconly|lucide|pikaicons?|nucleo|iconsax|originkit|components?|design system|styleguide|dynamic island|material|shader|shaders|lottie|animation|animated|micro interactions?|hero page|website|portfolio|illustrations?|gradient|border beam|rebrand|p5js|creative coding)\b/i.test(text)
}

function hasProductSignal(text) {
  return /\b(?:my|our|new|indie|built|made|created|designed|app|product|screens?|ui|ux|interface|download|try it|icons?|resource|toolkit|library|kit|figma|prototype|interaction|animation|animated|component|components|shader|shaders|lottie|dynamic island|material|website|portfolio|hero page|illustrations?|gradient|effect|rebrand|p5js)\b/i.test(text)
}

function isLowSignalPost(post) {
  const text = String(post?.text || '')
  const lower = cleanText(text).toLowerCase()
  const media = Array.isArray(post?.media) ? post.media : []
  const designCase = hasDesignSignal(text) && (media.length > 0 || /\b(?:iconly|lucide|pikaicons?|nucleo|iconsax|originkit)\b/i.test(text))
  if (!hasDesignOrIosMention(text)) return true
  if (!designCase && !hasReleaseSignal(text) && !/apps\.apple\.com|testflight\.apple\.com/i.test(text)) return true
  if (!hasProductSignal(text)) return true
  if (/\b(?:pro tip|commission|in-app purchase|app store rejection|apple'?s guidelines|before you submit|binary validation|privacy manifests|data declarations)\b/.test(lower)) return true
  if (/\b(?:booster packs|promo cards|sam'?s club|membership|#ad|coupon|restock)\b/.test(lower)) return true
  if (/\b(?:expansion has released|digital expansion|download pocket app)\b/.test(lower)) return true
  if (/\b(?:week \d+ check in|mrr|arr|churn|active subs|revenue(?:\(| last|:))\b/.test(lower)) return true
  if (/\b(?:available in eu|not available in the eu|curious to know if we truly need|can someone provide an example)\b/.test(lower)) return true
  if (/\b(?:i'?ve never built an ios app|time to take up this challenge|any tips for a beginner|for those who(?:'|’)ve shipped mobile apps)\b/.test(lower)) return true
  if (/\b(?:iphone app store policy|alternative app marketplaces|install apps outside apple'?s app store|app store commission)\b/.test(lower)) return true
  if (/\b(?:i'?m running|after running|inside plan mode|review inside)\b.{0,120}\b(?:published swift ios app|app store published)\b/.test(lower)) return true
  if (/\b(?:liquid glass ui has finally taken over|every iphone app)\b/.test(lower)) return true
  if (/\b(?:hiring|job|apply now|course|bootcamp|tutorial|newsletter|podcast|meetup|conference|coupon|giveaway|airdrop|token)\b/.test(lower) && !/apps\.apple\.com|testflight\.apple\.com/.test(lower)) return true
  if (/\b(?:android only|google play only|web app only|mac app only)\b/.test(lower)) return true
  if (/\b(?:looking for|need|seeking)\b.{0,80}\b(?:ios developer|swift developer|app developer)\b/.test(lower)) return true
  if (/\b(?:how to build|learn ios|swiftui tutorial|course)\b/.test(lower) && !/\b(?:launched|shipped|released|app store)\b/.test(lower)) return true
  if (!media.length && !/apps\.apple\.com|testflight\.apple\.com/i.test(text)) return true
  return false
}

function curationDecision(post) {
  const manualSeed = isManualSeedPost(post)
  if (!manualSeed && bookmarkCount(post?.metrics) < minBookmarks) return { keep: false, reason: 'below-min-bookmarks' }
  if (!post?.url || !post?.author || !post?.text) return { keep: false, reason: 'missing-url-author-or-text' }
  if (!manualSeed && isLowSignalPost(post)) return { keep: false, reason: 'low-signal-or-not-design-reference' }
  return { keep: true, reason: manualSeed ? 'manual-seed-curated' : 'design-or-ios-evidence' }
}

function actionSummaryFromText(text, media = 'text') {
  const clean = cleanText(text)
  const lower = clean.toLowerCase()
  const appName = appNameFromText(text)
  const prefix = appName ? `${appName} is presented as` : 'The post presents'
  if (/testflight|beta/.test(lower)) return `${prefix} an iOS beta or TestFlight release, with the original X post kept as the source.`
  if (/app store|apps\.apple\.com|download|now available|now live|launched|released|shipped/.test(lower)) return `${prefix} a newly released iOS app, usually with App Store or download context.`
  if (/swiftui|swift app/.test(lower)) return `${prefix} a Swift or SwiftUI-built iPhone app that has been shipped publicly.`
  if (/icons?|iconly|lucide|pikaicons?|nucleo|iconsax|originkit/.test(lower)) return `${prefix} a design icon or interface resource, with the original X post kept as the source.`
  if (/redesign|screens|ui|ux|interface|design|figma|prototype|concept/.test(lower)) return `${prefix} a product/interface design reference with visible design material.`
  if (media === 'video') return `${prefix} a video-backed design or app demo, with the source post preserved for verification.`
  const primary = informativeSentences(text).find((line) => line.length > 28) || clean
  return limitText(primary, 165)
}

function summaryFromText(text, media = 'text') {
  return [limitText(actionSummaryFromText(text, media), 165)]
}

function artifactTypeFor(text, media) {
  const lower = String(text || '').toLowerCase()
  if (/testflight|beta/.test(lower)) return 'testflight'
  if (/app store|apps\.apple\.com|download/.test(lower)) return 'app-store'
  if (/icons?|iconly|lucide|pikaicons?|nucleo|iconsax|originkit/.test(lower)) return 'resource'
  if (/redesign|screens|ui|ux|interface|design|figma|prototype|concept/.test(lower)) return 'design'
  if (/launch|released|shipped|now available|now live/.test(lower)) return 'launch'
  return media === 'video' ? 'video' : media === 'image' ? 'image' : 'case-study'
}

function uniqueMatches(lower, pairs) {
  return pairs.filter(([pattern]) => pattern.test(lower)).map(([, value]) => value)
}

function facetFields(post, media) {
  const text = String(post?.text || post?.originalText || '')
  const lower = text.toLowerCase()
  const capability = uniqueMatches(lower, [
    [/\bapp store|apps\.apple\.com|download/, 'app-store-release'],
    [/\btestflight|beta/, 'beta-release'],
    [/\bswiftui|swift\b|xcode/, 'native-ios'],
    [/\bui|ux|design|screens?|interface|figma|prototype|concept/, 'product-design'],
    [/\bicons?|iconly|lucide|pikaicons?|nucleo|iconsax|originkit/, 'design-resource'],
  ])
  const evidence = []
  if (/apps\.apple\.com/i.test(text)) evidence.push('app-store-link')
  if (/testflight\.apple\.com|testflight/i.test(text)) evidence.push('testflight')
  if (/launch|released|shipped|now available|now live|download/.test(lower)) evidence.push('release-claim')
  if (media !== 'text') evidence.push('media-backed')
  if (!evidence.length) evidence.push('commentary')
  return {
    artifactType: artifactTypeFor(text, media),
    medium: media,
    capability: [...new Set(capability)],
    evidence: [...new Set(evidence)],
    domain: categoriesFor(text).filter((category) => !['app-store', 'testflight', 'news', 'design'].includes(category)),
    tech: hasIosAppMention(text) ? ['ios'] : [],
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
  const publicPath = `/ios-apps-media/${fileName}`
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
        { cwd: ROOT, timeout: 60_000, stdio: ['ignore', 'ignore', 'pipe'] }
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
  const publicPath = `/ios-apps-avatars/${fileName}`
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
  const sourceUrl = isManualSeedPost(post) && /^https:\/\/x\.com\//i.test(post.sourceSeed || '') ? post.sourceSeed : post.url
  const item = {
    id: `${post.author}-${slugify(post.id || post.url || post.text)}`,
    title: titleFromText(post.text),
    author: post.authorName || post.author,
    handle: `@${post.author}`,
    sourceUrl,
    seedSourceUrl: /^https:\/\/x\.com\//i.test(post.sourceSeed || '') ? post.sourceSeed : '',
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
    note: 'AI-style summary and product labels are generated from the original post text. Verify App Store availability from the source before publishing claims.',
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
const minBookmarks = nonNegativeNumber(args['min-bookmarks'], 20)
const cacheMedia = flag(args['cache-media'], true)
const cacheFrom = String(args['cache-from'] || '')
const reviewLimit = Math.max(1, Math.min(Number(args['review-drops'] || 40), 200))
const mergeExisting = flag(args['merge-existing'], !args.input)
CACHE_ASSETS = args['cache-assets'] !== '0'

const generatedAt = new Date().toISOString()
const batches = loadInputBatches(args)
const allPosts = batches.flatMap((batch) => batch.posts.map((post) => ({ ...post, sourceRun: batch.sourceRun })))
const curationByUrl = new Map()
const candidateByKey = new Map()

for (const batch of batches) {
  for (const post of batch.posts) {
    const sourcedPost = { ...post, sourceRun: batch.sourceRun }
    const decision = curationDecision(sourcedPost)
    if (sourcedPost?.url && !curationByUrl.has(sourcedPost.url)) curationByUrl.set(sourcedPost.url, { post: sourcedPost, decision })
    if (!decision.keep || !sourcedPost?.url) continue
    const key = dedupeKeyForText(sourcedPost.text) || sourcedPost.url
    const prev = candidateByKey.get(key)
    const fetchRuns = [...new Set([...(prev?.fetchRuns || []), batch.sourceRun])]
    if (!prev || scoreMetrics(sourcedPost.metrics || {}) > scoreMetrics(prev.metrics || {})) {
      candidateByKey.set(key, { ...sourcedPost, fetchRuns })
    } else {
      prev.fetchRuns = fetchRuns
    }
  }
}

const selected = [...candidateByKey.values()]
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
if (mergeExisting) {
  for (const item of loadExistingItems()) {
    if (!/^https:\/\/x\.com\//i.test(item?.sourceUrl || '')) continue
    if (item?.sourceUrl && hasDesignOrIosMention(item.originalText || item.title || '')) byUrl.set(item.sourceUrl, item)
  }
}
for (const item of selected) {
  const prev = byUrl.get(item.sourceUrl)
  byUrl.set(item.sourceUrl, {
    ...prev,
    ...item,
    sourceUrl: item.seedSourceUrl || item.sourceUrl,
    firstSeenAt: prev?.firstSeenAt || item.firstSeenAt,
    lastFetchedAt: generatedAt,
    fetchRuns: [...new Set([...(prev?.fetchRuns || []), ...(item.fetchRuns || [])])],
    mediaThumbUrl: item.mediaThumbUrl || prev?.mediaThumbUrl || '',
  })
}

const dedupedCollection = new Map()
for (const item of byUrl.values()) {
  const key = dedupeKeyForText(item.originalText || item.title || '') || item.sourceUrl
  const prev = dedupedCollection.get(key)
  const itemHasSeedSource = Boolean(item.seedSourceUrl)
  const prevHasSeedSource = Boolean(prev?.seedSourceUrl)
  if (!prev || (itemHasSeedSource && !prevHasSeedSource) || scoreMetrics(item.metrics || {}) > scoreMetrics(prev.metrics || {})) {
    dedupedCollection.set(key, item)
  }
}

const collection = [...dedupedCollection.values()]
  .filter((item) => /^https:\/\/x\.com\//i.test(item.sourceUrl || ''))
  .filter((item) => isManualSeedItem(item) || bookmarkCount(item.metrics) >= minBookmarks)
  .filter((item) => isManualSeedItem(item) || hasDesignOrIosMention(item.originalText || item.title || ''))
  .filter((item) => item.media !== 'text')
  .filter((item) => isManualSeedItem(item) || !isLowSignalPost(itemAsPost(item)))
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
const activeShardFiles = new Set(shardList.map((shard) => shard.file))
for (const entry of readdirSync(OUT_DIR, { withFileTypes: true })) {
  if (!entry.isFile() || !/^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name)) continue
  if (!activeShardFiles.has(entry.name)) rmSync(join(OUT_DIR, entry.name), { force: true })
}

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
  cliStatus: `Loaded ${allPosts.length} locally archived X posts from ${batches.length} fetch runs; collection now has ${collection.length} media-backed design/iOS cards and ${creatorPool.length} creator profiles.`,
  sourceRun: 'local-archive',
  fetchRuns: [...new Set(collection.flatMap((item) => item.fetchRuns || []))],
  filters: {
    minBookmarks,
    manualSeedOverride: true,
  },
  total: collection.length,
  categoryCounts: sortCategoryCounts([...categoryCounts.entries()]).map(([key, count]) => ({ key, count })),
  pageSize: CHUNK_SIZE,
  pages: pageList,
  chunks: pageList.map(({ file, count, fromDate, toDate }) => ({ file: file.replace(/^pages\//, 'chunks/'), count, fromDate, toDate })),
  shards: shardList,
})

mkdirSync(ARCHIVE_ROOT, { recursive: true })
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

console.log(`Loaded ${allPosts.length} archived iOS app posts from ${batches.length} runs`)
console.log(`Merged ${selected.length} local candidates into ${collection.length} total cards and ${creatorPool.length} creators at ${OUT_DIR}`)
console.log(`Applied filters: min-bookmarks=${minBookmarks}`)
