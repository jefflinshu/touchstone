import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const OUT_DIR = join(ROOT, 'web', 'public', 'fable5-data')
const ARCHIVE_ROOT = join(ROOT, 'data-archive', 'fable5')
const CURATION_OVERRIDES_PATH = join(ARCHIVE_ROOT, 'curation-overrides.json')
const PUBLIC_MEDIA_DIR = join(ROOT, 'web', 'public', 'fable5-media')
const PUBLIC_AVATAR_DIR = join(ROOT, 'web', 'public', 'fable5-avatars')
const CHUNK_SIZE = 24
let CACHE_ASSETS = true
let previousShardFiles = []

function usage() {
  console.error(
    'Usage: node scripts/update-fable5-showcases.mjs [--input data-archive/fable5/<run-id>/window-posts.json | --archive-root data-archive/fable5] [--limit N] [--cache-assets 1|0] [--cache-media 1|0] [--cache-from YYYY-MM-DD]'
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
      .slice(0, 54) || 'fable5-post'
  )
}

function titleFromText(text) {
  const clean = cleanText(text)
  const lower = clean.toLowerCase()

  if (
    /generally available|rolling out|now available|now live/.test(lower) ||
    /\bintroducing\s+claude\s+(?:fable|mythos)\b/.test(lower)
  )
    return 'Claude Fable 5 availability update'
  if (/12-min|12 min|tutorial/.test(lower) && /animated|website|award/.test(lower)) return 'Tutorial for animated award-winning websites'
  if (/full guide|prompting structure|how to prompt|old prompts may/.test(lower)) return 'Guide to prompting Fable 5 autonomous workflows'
  if (/repo audit|project improvement|audit .*prompt|prompt made/.test(lower)) return 'Repo audit and improvement prompt'
  if (/changed how we work|claude code team/.test(lower)) return 'How the Claude Code team works with Fable 5'
  if (/3 fully functioning web apps|3 apps with 1 prompt|make 3 apps/.test(lower)) return 'Three app prototypes built from one prompt'
  if (/ship my first ios app/.test(lower)) return 'iOS app shipped from one prompt'
  if (/shader|pattern images|pattern videos|pattern.*gifs/.test(lower)) return 'Open-source shader and pattern generator'
  if (isComparisonText(lower)) return comparisonTitle(clean)
  if (/higgsfield/.test(lower) && /playable game|story|visuals/.test(lower)) return 'Playable story game with Higgsfield MCP'
  if (/liquid glass|glass liquid/.test(lower)) return 'Liquid-glass UI experiment'
  if (/landing page/.test(lower)) return 'Landing page generated with Fable 5'
  if (/league of legends|champion design/.test(lower)) return 'League of Legends champion kit designed in one prompt'
  if (/made this video in (?:five|5) prompts|created this video with couple of prompts|single prompt.*vid[eé]o|vid[eé]o.*single prompt/.test(lower)) return 'Short video generated from a few prompts'
  if (/motion design|motion|animation|animated|cinematic/.test(lower)) return 'Prompt-driven motion or animation demo'
  if (/game|minecraft|skyrim|pokemon|mario|monopoly|gta|call of duty|rpg|tower defense/.test(lower)) return gameTitle(clean)
  if (/three\.?js|webgl|3d|cad|fusion|voxel|walkable|spatial/.test(lower)) return spatialTitle(clean)
  const direct = concreteTitle(clean)
  if (direct) return direct
  if (/website|web app|site|portfolio|hero/.test(lower)) return 'Website or web app built with Fable 5'
  if (/app|mobile|ios|android|dashboard|saas/.test(lower)) return 'App prototype built with Fable 5'
  if (/agent|subagent|autonomous|loop|orchestrat|memory|decides next/.test(lower)) return 'Autonomous agent workflow for Fable 5'
  if (/workflow|automation|pipeline|orders|warehouse|sales call|customer|posting loop/.test(lower)) return 'Automated workflow built around Fable 5'
  if (/safety|guardrail|refus|cyber|biology|bio|chemistry|abuse|policy|copyright|deepfake|fraud|scam/.test(lower)) return 'Fable 5 safety or policy discussion'

  return titleFromSentence(informativeSentences(text)[0] || clean) || 'Fable 5 post'
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
    .replace(/[❤️‍🔥🔥🤯💥🚀👀👇⬇️📣📢🚨✅]/g, '')
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

function informativeSentences(text) {
  const normalized = String(text || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\r/g, '\n')
  const pieces = normalized
    .split(/\n+|(?<=[.!?。！？])\s+/)
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !/^(wow|holy|insane|unbelievable|mind blown|speechless|ok so|nah|wtf)\b[!. ]*$/i.test(line))
    .filter((line) => !/^claude (?:fable|mythos).{0,24}(?:insane|wild|crazy|unbelievable)[!. ]*$/i.test(line))
    .filter((line) => !/\b(?:insane|crazy|wild|unbelievable|mind blown)\b/i.test(line) || /\b(?:build|built|create|created|made|make|recreated|designed|implemented|generated|prompt|tutorial|benchmark|workflow)\b/i.test(line))
    .filter((line) => !/^bookmark this|^save this|^thread\b|^here'?s/i.test(line))
    .filter((line) => !/^(?:it'?s?\s+over|it\s+over|rip\b|gg\b|is this over)/i.test(line))
  return pieces
}

function titleFromSentence(sentence) {
  const line = trimPunctuation(cleanLine(sentence))
    .replace(/^i\s+(?:just\s+)?/i, '')
    .replace(/^we\s+(?:just\s+)?/i, '')
    .replace(/^claude fable 5\s+(?:just\s+)?/i, '')
  if (!line) return ''
  return limitText(line, 78)
}

function concreteTitle(clean) {
  const source = cleanLine(clean)
  const promptBuild = source.match(/prompt:\s*["'“”]?(?:build|create|make)\s+(.{3,90}?)(?:["'“”]|$|[.!?])/i)
  if (promptBuild) {
    const phrase = normalizeTitlePhrase(promptBuild[1])
    if (validTitlePhrase(phrase)) return limitText(`${phrase} prompt`, 84)
  }

  const patterns = [
    { re: /\b(?:recreated|rebuilt|cloned)\s+(?:the\s+)?(.{3,90}?)(?:\s+in\s+(?:one|1)\s+prompt|[.!?]|$)/i, suffix: 'recreated with Fable 5' },
    { re: /\bone[- ]?shotted\s+(?:this\s+|a\s+|an\s+|the\s+)?(.{3,90}?)(?:[.!?]|$)/i, suffix: 'one-shotted with Fable 5' },
    { re: /\bbuilt\s+(?:a\s+|an\s+|the\s+|my\s+)?(.{3,90}?)(?:\s+(?:with|using|from|in|on|for)\b|[.!?]|$)/i, suffix: 'built with Fable 5' },
    { re: /\bcreated\s+(?:a\s+|an\s+|the\s+|this\s+)?(.{3,90}?)(?:\s+(?:with|using|from|in|on|for)\b|[.!?]|$)/i, suffix: 'created with Fable 5' },
    { re: /\bmade\s+(?:a\s+|an\s+|the\s+|this\s+)?(.{3,90}?)(?:\s+(?:with|using|from|in|on|for)\b|[.!?]|$)/i, suffix: 'made with Fable 5' },
  ]
  for (const { re, suffix } of patterns) {
    const match = source.match(re)
    const phrase = normalizeTitlePhrase(match?.[1] || '')
    if (validTitlePhrase(phrase)) return limitText(`${phrase} ${suffix}`, 84)
  }
  return ''
}

function normalizeTitlePhrase(text) {
  return trimPunctuation(text)
    .replace(/[👇👉]+/g, '')
    .replace(/\b(?:with|using|from|in|on|for|by)\s*$/i, '')
    .replace(/\b(?:claude|fable|mythos)(?:\s+\d+)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function validTitlePhrase(phrase) {
  const lower = String(phrase || '').toLowerCase()
  if (phrase.length < 4 || phrase.length > 95) return false
  if (/^(safe|with|using|from|in|on|for|by|it|this|that|everything|anything)$/i.test(phrase)) return false
  if (/^(with|using|from|in|on|for|by)\b/.test(lower)) return false
  if (/\b(?:insane|crazy|wild|unbelievable|holy shit|wtf)\b/.test(lower)) return false
  if (!/[a-z0-9]/i.test(phrase)) return false
  return true
}

function comparisonTitle(clean) {
  if (/swe-bench|frontiercode|benchmark/i.test(clean)) return 'Fable 5 benchmark results compared with other models'
  const match = clean.match(/\bcompared?\s+(?:it\s+)?(?:with|to)\s+(.{3,90}?)(?:[.!?]|$)/i)
  if (match) return limitText(`Fable 5 compared with ${trimPunctuation(match[1])}`, 84)
  return 'Fable 5 comparison with other models'
}

function spatialTitle(clean) {
  if (/3d-printable|browser-based CAD|built-in AI copilot/i.test(clean)) return '3D-printable CAD editor with an AI copilot'
  if (/cad|fusion|boeing/i.test(clean)) return titleFromSentence(clean.match(/(?:built|created|designs?|made).{0,110}/i)?.[0] || '3D CAD model built with Fable 5')
  if (/kyoto|neighborhood|walkable/i.test(clean)) return 'Walkable 3D Kyoto neighborhood in Three.js'
  if (/black hole|ray-traced/i.test(clean)) return 'Ray-traced black hole simulation in WebGL'
  if (/formula 1|drifting donut/i.test(clean)) return '3D Formula 1 drifting simulation'
  return '3D or WebGL prototype built with Fable 5'
}

function gameTitle(clean) {
  if (/skyrim/i.test(clean)) return 'Skyrim-style game recreated from one prompt'
  if (/pokemon|firered/i.test(clean)) return 'Pokemon FireRed run driven by screenshots'
  if (/monopoly/i.test(clean)) return 'AI-lab Monopoly clone with multiplayer rules'
  if (/minecraft/i.test(clean)) return 'Minecraft-style game built with one prompt'
  if (/gta 2/i.test(clean)) return 'GTA 2 clone built in two hours'
  if (/call of duty/i.test(clean)) return 'Call of Duty-style clone one-shotted with Fable 5'
  if (/poolrooms|backrooms|horror/i.test(clean)) return 'Browser horror game generated from one prompt'
  if (/billiards/i.test(clean)) return '3D billiards prototype with spin and drag'
  return 'Playable game prototype built with Fable 5'
}

function similarToTitle(line, title) {
  const words = (value) =>
    new Set(
      String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 3 && !['claude', 'fable', 'with', 'from', 'this', 'that'].includes(word))
    )
  const a = words(line)
  const b = words(title)
  if (!a.size || !b.size) return false
  const overlap = [...a].filter((word) => b.has(word)).length
  return overlap / Math.min(a.size, b.size) >= 0.55
}

function isComparisonText(lower) {
  return /\b(compare|compared|benchmark)\b/.test(lower) || /\b(?:fable|claude|opus|gpt|model)\b.{0,40}\bvs\.?\b.{0,40}\b(?:fable|claude|opus|gpt|model)\b/.test(lower)
}

function actionSummaryFromText(text, media = 'text') {
  const clean = cleanText(text)
  const lower = clean.toLowerCase()
  const sentences = informativeSentences(text)
  const title = titleFromText(text)

  const specific = specificSummary(clean, lower, title)
  if (specific) return specific

  const primary =
    sentences.find((line) => {
      const value = line.toLowerCase()
      return (
        value.length > 28 &&
        !similarToTitle(line, title) &&
        /\b(build|built|created|made|recreated|designed|tutorial|prompt|compared|implemented|generated|available|workflow|benchmark|game|website|app|video|3d|ui|mcp|model)\b/i.test(value)
      )
    }) ||
    sentences.find((line) => line.length > 28 && !similarToTitle(line, title)) ||
    clean

  let description = primary
    .replace(/^i asked/i, 'The author asked')
    .replace(/^i gave/i, 'The author gave')
    .replace(/^i just/i, 'The author says they')
    .replace(/^we just/i, 'The post says they')
    .replace(/^it just/i, 'The post says it')
    .replace(/^now you can/i, 'Shows a workflow where you can')
    .replace(/^(?:wow|holy(?: shit)?|unbelievable|mind blown|speechless)[^a-z0-9]+/i, '')
    .replace(/^claude (?:fable|mythos)[^.!?]{0,40}\b(?:insane|crazy|wild|unbelievable)[!.\s]*/i, '')
    .replace(/\b(?:🤯|🔥|❤️‍🔥|💥|🚀|👇|⬇️|👀)\b/g, '')

  if (/prompt:\s*["'“”]?([^"'“”\n.]{3,80})/i.test(text)) {
    const prompt = trimPunctuation(text.match(/prompt:\s*["'“”]?([^"'“”\n.]{3,80})/i)?.[1] || '')
    if (prompt && !description.toLowerCase().includes(prompt.toLowerCase())) description += ` Prompt: "${prompt}".`
  }
  return limitText(summaryStyle(description, clean, media), 165)
}

function specificSummary(clean, lower, title) {
  if (/system prompt|system prompt الكامل|leaked|تسريب|تسرب/.test(lower) && /fable|mythos|claude/.test(lower)) {
    return 'Reports a leaked Claude Fable 5 system prompt and frames the release as a full agentic workflow system, not just a chat model.'
  }
  if (/artificial analysis|coding agent index|deepswe|swe-bench|benchmark/.test(lower)) {
    return 'Shares updated coding-agent benchmark results and positions Claude Fable 5 against other frontier coding agents.'
  }
  if (/simcity/.test(lower)) {
    return 'Shows a SimCity-style playable prototype attributed to Fable 5, with the original post linking to a live demo.'
  }
  if (/higgsfield games|multiplayer games from a prompt|build and deploy multiplayer games/.test(lower)) {
    return 'Introduces a prompt-to-multiplayer-game workflow powered by Claude Fable 5 and Higgsfield MCP.'
  }
  if (/purely claude fable|no other models|no other models, assets/.test(lower)) {
    return 'Shows a game prototype the author says was built with Claude Fable alone, without outside models or prepared assets.'
  }
  if (/one[- ]?shotted|one prompt|single prompt/.test(lower) && /game|playable|clone/.test(lower)) {
    return `Shows a playable game prototype attributed to ${modelName(clean)}, with the post emphasizing one-prompt or one-shot generation.`
  }
  if (/one[- ]?shotted|one prompt|single prompt/.test(lower) && /website|landing|web app|site/.test(lower)) {
    return `Shows a website or web app generated with ${modelName(clean)}, with the original post framing it as a one-prompt build.`
  }
  if (/tutorial|guide|prompting|prompt structure|full prompt|copy prompt/.test(lower)) {
    return `Shares a prompt or tutorial for reproducing a ${artifactLabel(lower)} workflow with ${modelName(clean)}.`
  }
  if (/mcp|agent|workflow|automation|subagent|autonomous/.test(lower)) {
    return `Describes an agentic workflow around ${modelName(clean)}, focused on ${artifactLabel(lower)} rather than a simple chat response.`
  }
  if (/video|motion|animation|animated|cinematic/.test(lower)) {
    return `Shows a motion or video generation demo associated with ${modelName(clean)}, based on the original post's media and description.`
  }
  if (/3d|three\.?js|webgl|blender|voxel|spatial|cad/.test(lower)) {
    return `Shows a 3D or interactive visual prototype built with ${modelName(clean)}, based on the original post's media and description.`
  }
  if (/game|playable|minecraft|skyrim|pokemon|mario|rpg|tower defense/.test(lower)) {
    return `Shows a playable game or game-like prototype associated with ${modelName(clean)}.`
  }
  if (/website|landing|web app|site|portfolio|hero/.test(lower)) {
    return `Shows a website or web-app build associated with ${modelName(clean)}.`
  }
  if (title && title !== 'Fable 5 post') {
    return limitText(`Summarizes an original X post about ${title.charAt(0).toLowerCase()}${title.slice(1)}.`, 165)
  }
  return ''
}

function modelName(clean) {
  if (/mythos/i.test(clean)) return 'Claude Mythos / Fable 5'
  return 'Claude Fable 5'
}

function artifactLabel(lower) {
  if (/game|playable/.test(lower)) return 'game-building'
  if (/website|landing|web app|site/.test(lower)) return 'web-building'
  if (/video|motion|animation/.test(lower)) return 'motion-design'
  if (/3d|three\.?js|webgl|blender/.test(lower)) return '3D prototyping'
  if (/code|repo|repository|debug|refactor/.test(lower)) return 'coding'
  if (/agent|workflow|automation|mcp/.test(lower)) return 'agentic automation'
  return 'Fable 5'
}

function summaryStyle(description, clean, media) {
  const lower = `${description} ${clean}`.toLowerCase()
  if (/^(shows|shares|reports|introduces|describes|compares)\b/i.test(description)) return description
  if (/benchmark|compare|compared|versus|vs\b/.test(lower)) return `Compares Claude Fable 5 with other coding agents or models, based on the original post's benchmark claim.`
  if (/prompt:|full prompt|tutorial|guide/.test(lower)) return `Shares a prompt or tutorial around ${artifactLabel(lower)} with ${modelName(clean)}.`
  if (/built|made|created|recreated|designed|one[- ]?shotted|one prompt/.test(lower)) {
    return `Shows a ${artifactLabel(lower)} result the author says was built with ${modelName(clean)}.`
  }
  if (media === 'video') return `Shows a video demo related to ${modelName(clean)}, with the original post preserved as the source.`
  if (media === 'image') return `Shows an image-backed case related to ${modelName(clean)}, with the original post preserved as the source.`
  return description
}

function summaryFromText(text, media = 'text') {
  const description = actionSummaryFromText(text, media)
  return [description]
}

function tagsFor(text) {
  const lower = String(text || '').toLowerCase()
  const tags = ['fable5', ...categoriesFor(text)]
  if (/prompt/.test(lower)) tags.push('prompt')
  if (/site|website|landing|web app/.test(lower)) tags.push('web')
  if (/video|demo|clip/.test(lower)) tags.push('demo')
  if (/guardrail|refus|risk|cyber|bio/.test(lower)) tags.push('limits')
  return [...new Set(tags)].slice(0, 8)
}

const CATEGORY_ORDER = [
  'games',
  'apps',
  'websites',
  'videos',
  '3d',
  'design',
  'agents',
  'prompts',
  'code',
  'research',
  'safety',
  'news',
  'experiments',
]

function categoriesFor(text) {
  const lower = String(text || '').toLowerCase()
  const categories = []
  const add = (category, pattern) => {
    if (pattern.test(lower)) categories.push(category)
  }

  add('games', /\b(?:game|playable|minecraft|skyrim|pokemon|mario|monopoly|gta|horror|rpg|tower defense|unity|levels|wasd|driving|simulator)\b/)
  add('apps', /\b(?:app|mobile|ios|android|dashboard|saas|tool|editor|playground|visualizer|generator|calculator)\b/)
  add('websites', /\b(?:website|landing|site|web app|portfolio|hero section|product page|threejs website)\b/)
  add('videos', /\b(?:video|motion|animation|animated|cinematic|clip|remotion|ffmpeg|lottie|scriptwriting)\b/)
  add('3d', /\b(?:3d|three\.?js|threejs|webgl|blender|model|voxel|spatial|cad|fusion|robot|map|city|walkable|parametric)\b/)
  add('design', /\b(?:design|ui|ux|figma|liquid glass|glass liquid|portfolio|presentation|deck|email campaign|photoshop)\b/)
  add('agents', /\b(?:agent|subagent|autonomous|loop|orchestrat|workflow|automation|pipeline|mcp|browser use|multi-step)\b/)
  add('prompts', /\b(?:prompt|prompting|tutorial|guide|playbook|step-by-step|cheat sheet|prompt pack|prompts below|how to|method)\b/)
  add('code', /\b(?:code|codebase|repo|repository|refactor|debug|migration|software engineering|pull request|claude code|audit)\b/)
  add('research', /\b(?:research|benchmark|eval|evaluation|compare|compared|comparison|vs\b|versus|analysis|deep dive|tested against|physics simulation|study|paper)\b/)
  add('safety', /\b(?:safety|guardrail|refus|risk|cyber|biology|bio|chemistry|abuse|policy|copyright|deepfake|fraud|scam|exploit|vulnerability)\b/)
  add('news', /\b(?:launch|released|available today|now available|now live|announcing|introducing|rolling out|integrated|support)\b/)

  const unique = [...new Set(categories)].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b))
  return unique.length ? unique : ['experiments']
}

function sceneFor(text) {
  return categoriesFor(text)[0] || 'experiments'
}

function artifactTypeFor(text, media) {
  const lower = String(text || '').toLowerCase()
  if (/game|minecraft|skyrim|pokemon|mario|rpg|playable/.test(lower)) return 'game'
  if (/website|landing|web app|site/.test(lower)) return 'website'
  if (/app|mobile|ios|android|dashboard|saas/.test(lower)) return 'app'
  if (/video|motion|animation|animated|cinematic/.test(lower)) return 'video'
  if (/repo|repository|codebase|migration|refactor|debug|pull request/.test(lower)) return 'codebase'
  if (/agent|subagent|loop|autonomous/.test(lower)) return 'agent-loop'
  if (/prompt pack|full prompt|cheat sheet|playbook|tutorial|guide/.test(lower)) return 'prompt-pack'
  if (/3d|three\.?js|webgl|blender|model|voxel|spatial/.test(lower)) return '3d-scene'
  return media === 'video' ? 'video' : media === 'image' ? 'image' : 'case-study'
}

function uniqueMatches(lower, pairs) {
  return pairs.filter(([pattern]) => pattern.test(lower)).map(([, value]) => value)
}

function facetFields(post, media) {
  const text = String(post?.text || post?.originalText || '')
  const lower = text.toLowerCase()
  const capability = uniqueMatches(lower, [
    [/\bone[- ]?(prompt|shot)|one shotted|one-shotted/, 'one-shot'],
    [/\brefactor|migration|audit|debug/, 'code-improvement'],
    [/\bdesign|ui|ux|figma|liquid glass|glass liquid/, 'design-gen'],
    [/\bmotion|animation|animated|video|cinematic/, 'motion-gen'],
    [/\b3d|three\.?js|webgl|blender|model|voxel/, '3d-gen'],
    [/\bautomation|workflow|pipeline|agent|loop|orchestrat/, 'automation'],
  ])
  const tech = uniqueMatches(lower, [
    [/\bthree\.?js|threejs|webgl/, 'threejs'],
    [/\bblender/, 'blender'],
    [/\bmcp\b/, 'mcp'],
    [/\bmanim\b/, 'manim'],
    [/\bhiggsfield/, 'higgsfield'],
    [/\bhyperframe/, 'hyperframe'],
    [/\bclaude code/, 'claude-code'],
    [/\breact|nextjs|next\.js/, 'react'],
  ])
  const risk = uniqueMatches(lower, [
    [/\bsafety|guardrail|refus|cyber|biology|chemistry/, 'safety'],
    [/\bcopyright|clone|recreated|pokemon|mario|skyrim|minecraft|gta/, 'copyright'],
    [/\bbenchmark|compare|compared|vs\b|versus/, 'benchmark-claim'],
    [/\$\d|\brevenue|month|sales|leads|ads|shorts/, 'market-claim'],
  ])
  const domain = uniqueMatches(lower, [
    [/\becommerce|shop|store|orders/, 'ecommerce'],
    [/\banalytics|dashboard|metrics/, 'analytics'],
    [/\bmarketing|ads|vsl|shorts|leads|sales/, 'marketing'],
    [/\bportfolio|landing|website|hero/, 'web-design'],
    [/\bgame|minecraft|skyrim|pokemon|mario|rpg/, 'game-dev'],
    [/\beducation|tutorial|guide|course/, 'education'],
  ])
  const evidence = []
  if (extractPrompt(text)) evidence.push('prompted')
  if (/tutorial|guide|playbook|cheat sheet|full prompt|prompt pack/.test(lower)) evidence.push('tutorial')
  if (isComparisonText(lower)) evidence.push('benchmark-claim')
  if (/one prompt|one-shot|one shotted|one-shotted|built|made|created|recreated|designed/.test(lower)) evidence.push('unverified-claim')
  if (!evidence.length) evidence.push('commentary')

  return {
    artifactType: artifactTypeFor(text, media),
    medium: media,
    capability: [...new Set(capability)],
    evidence: [...new Set(evidence)],
    domain: [...new Set(domain)],
    tech: [...new Set(tech)],
    risk: [...new Set(risk)],
  }
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

const KEYWORDS = [
  'one prompt',
  'prompt',
  'game',
  'website',
  'landing page',
  '3d',
  'mcp',
  'tutorial',
  'build',
  'demo',
  'comparison',
  'physics',
  'mobile',
  'multiplayer',
]

function keywordHits(text) {
  const lower = String(text || '').toLowerCase()
  return KEYWORDS.filter((keyword) => lower.includes(keyword))
}

function mediaKind(post) {
  const media = Array.isArray(post.media) ? post.media : []
  if (media.some((item) => /video|animated/i.test(item.type))) return 'video'
  if (media.length) return 'image'
  return 'text'
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

function loadCurationOverrides() {
  try {
    const payload = JSON.parse(readFileSync(CURATION_OVERRIDES_PATH, 'utf8'))
    const decisions = Array.isArray(payload?.decisions) ? payload.decisions : []
    return new Map(
      decisions
        .filter((item) => item?.url && /^(?:keep|drop)$/.test(String(item.decision || '')))
        .map((item) => [item.url, { decision: item.decision, reason: item.reason || 'manual override' }])
    )
  } catch {
    return new Map()
  }
}

function promptStatus(text) {
  return extractPrompt(text) ? 'prompted' : 'commentary'
}

function extractPrompt(text) {
  const raw = String(text || '').trim()
  const match = raw.match(/(?:^|\n|\s)prompt\s*:\s*([“"']?[\s\S]+)$/i)
  if (!match) return ''
  return match[1].replace(/https?:\/\/t\.co\/\S+/g, '').trim()
}

function promptFromPost(post) {
  return extractPrompt(post.text)
}

function linkedItems(post) {
  return [
    ...(Array.isArray(post.threadItems) ? post.threadItems : []),
    ...(Array.isArray(post.replies) ? post.replies : []),
    ...(Array.isArray(post.comments) ? post.comments : []),
    ...(Array.isArray(post.raw?.threadItems) ? post.raw.threadItems : []),
    ...(Array.isArray(post.raw?.replies) ? post.raw.replies : []),
  ]
}

function looksLikeThreadIndex(text) {
  const lower = cleanText(text).toLowerCase()
  return (
    /(?:^|\s)(?:🧵|thread|mega thread|megathread)(?:\s|$)/i.test(text) ||
    /\bhere (?:are|is)\b.*\b(?:things|examples|demos|builds|people)\b/.test(lower) ||
    /\b(?:wildest|best|top|coolest)\b.*\b(?:things|examples|demos|builds)\b/.test(lower) ||
    /\b(?:roundup|collection|curated|compilation)\b/.test(lower)
  )
}

function hasCaseEvidence(post) {
  const text = String(post?.text || post?.fullText || post?.full_text || '')
  const lower = cleanText(text).toLowerCase()
  const media = Array.isArray(post?.media) ? post.media : []
  if (post?.sourceMode === 'seed-tweet' && media.length && /\b(?:claude|fable|mythos)\b/i.test(text)) return true
  const hasBuildLanguage =
    /\b(?:prompt|built|made|created|recreated|designed|one-shotted|one shot|one prompt|game|website|web app|ui|ux|motion|animation|video|css|3d|mcp|code|migration|prototype|compare|compared|versus|benchmark)\b/.test(
      lower
    )
  if (media.length && hasBuildLanguage) return true
  if (extractPrompt(text)) return true
  if (/\b(?:built|made|created|recreated|designed|one-shotted|one prompt)\b/.test(lower) && !looksLikeThreadIndex(text)) return true
  return false
}

function hasPublicEvidence(text) {
  const raw = String(text || '')
  const withoutShortlinks = raw.replace(/https?:\/\/(?:t\.co|x\.com|twitter\.com)\/\S+/gi, '')
  return (
    /https?:\/\/(?!localhost(?::|\/|$)|127\.0\.0\.1(?::|\/|$)|(?:www\.)?(?:x|twitter)\.com(?:\/|$)|t\.co(?:\/|$))\S+/i.test(
      withoutShortlinks
    ) ||
    /\b(?:github\.com|vercel\.app|netlify\.app|pages\.dev|try it|live demo|play here|source code|open source|public link)\b/i.test(raw) ||
    /(?:こちら|ここ).{0,12}遊べます|遊べます/i.test(raw)
  )
}

function isWeakTextOnlyClaim(post) {
  const text = String(post?.text || post?.fullText || post?.full_text || '')
  const lower = cleanText(text).toLowerCase()
  const media = Array.isArray(post?.media) ? post.media : []
  if (media.length || extractPrompt(text)) return false
  if (/\b(?:localhost|127\.0\.0\.1)\b/i.test(text)) return true
  if (/\b(?:literally\s+)?nothing about coding\b|\bzero\b.{0,80}\b(?:coding|code)\b|\b(?:coding|code)\b.{0,80}\bzero\b/i.test(text)) return true
  if (!hasPublicEvidence(text)) return true
  const hasConcreteBuild =
    /\b(?:built|created|made|recreated|one-shotted|one shot|prompt|demo|try|play|live|website|app|game|video|3d|webgl|github|source|benchmark)\b/i.test(
      text
    )
  if (!hasConcreteBuild) return true
  return false
}

function hasStrongArtifactEvidence(post) {
  const text = String(post?.text || post?.fullText || post?.full_text || '')
  const media = Array.isArray(post?.media) ? post.media : []
  if (extractPrompt(text)) return true

  const actorBuilt =
    /\b(?:had|asked|gave|fed)\s+(?:claude|fable|mythos)\b.{0,160}\b(?:build|create|make|generate|design|log|display|turn|convert|implement|simulate|visualize)\b/i.test(
      text
    ) ||
    /\b(?:i|we|this guy|someone|a user|the user|author|developer|founder|team|he|she)\b.{0,140}\b(?:built|created|made|recreated|cloned|generated|designed|implemented|one-shotted|one shot|tested|compared|fed|asked|gave)\b.{0,140}\b(?:game|website|web app|app|video|animation|3d|webgl|shader|ui|design|workflow|agent|benchmark|prototype|repo|codebase|prompt|model|map|dashboard)\b/i.test(
      text
    ) ||
    /\b(?:built|created|made|recreated|cloned|generated|designed|implemented|one-shotted|one shot|one prompt|tested|compared|benchmark)\b.{0,140}\b(?:game|website|web app|app|video|animation|3d|webgl|shader|ui|design|workflow|agent|benchmark|prototype|repo|codebase)\b/i.test(
      text
    ) ||
    /\b(?:game|website|web app|app|video|animation|3d|webgl|shader|ui|design|workflow|agent|benchmark|prototype|repo|codebase)\b.{0,140}\b(?:built|created|made|recreated|cloned|generated|designed|implemented|one-shotted|one shot|one prompt|tested|compared)\b/i.test(
      text
    )

  if (actorBuilt) return true
  if (media.length && /\b(?:all working|playable|try it|live demo|demo is real|source code|open sourcing|open-sourcing|github|repo|public link|you can play)\b/i.test(text)) {
    return true
  }
  if (media.length && /(?:こちら|ここ).{0,12}遊べます|遊べます|できた|作った/i.test(text)) return true
  if (
    media.length &&
    /\b(?:claude|fable|mythos)\b/i.test(text) &&
    /\b(?:asked fable|gave fable|fed it|\/goal:|shader|webgl|three\.?js|3d|css|ui|benchmark|game|app|website|video|animation|motion|prototype)\b/i.test(text)
  ) {
    return true
  }

  return false
}

function isNonCaseAnnouncement(post) {
  const text = String(post?.text || post?.fullText || post?.full_text || '')
  const media = Array.isArray(post?.media) ? post.media : []
  const strongArtifact = hasStrongArtifactEvidence(post)

  if (isSystemPromptLeakText(text)) return true
  if (isMoneyHustleText(text) && !strongArtifact) return true
  if (/\bnot made with claude fable\b|\bnot made with fable\b/i.test(text)) return true
  if (/\b(?:localhost|127\.0\.0\.1)\b/i.test(text) && !hasPublicEvidence(text) && !extractPrompt(text)) return true

  if (
    /\b(?:government|national security|foreign national|data retention|zero data retention|microsoft restricted|disabled access|cut off|guardrails?|policy|governance|exploit season|vulnerability|train competing ai models|weaker responses)\b/i.test(
      text
    ) &&
    !strongArtifact
  ) {
    return true
  }

  if (
    /\b(?:introducing claude fable|first in .*mythos|now generally available|rolling out in|now available in|now available on|now live in|now live on|available on|available in|web chat|premium model|api rollout|free until|try it out in)\b/i.test(
      text
    ) &&
    !strongArtifact
  ) {
    return true
  }

  if (
    /\b(?:top generations|what people have built|what people built|some projects people|people are already|roundup|collection|compilation|daily recap|here are .{0,40}(?:examples|demos|builds|things))\b/i.test(
      text
    )
  ) {
    return true
  }
  if (/\b(?:someone|somebody)\b.{0,80}\b(?:vibe-coded|built|created|made|rebuilt|recreated)\b/i.test(text) && !/\b(?:i|we)\b.{0,80}\b(?:built|created|made|asked|gave)\b/i.test(text)) {
    return true
  }

  if (/\b(?:bookmark|comment\s+["']?prompt|dm\b|follow|copy this|thank me later|free article|full playbook)\b/i.test(text)) {
    return true
  }

  if (/\b(?:compared to fable 5|compared with fable 5|better than fable 5|any other model)\b/i.test(text) && /\b(?:marketplace|export|tesana|platform|launch it directly)\b/i.test(text)) {
    return true
  }

  if (
    /\b(?:printing money|killed (?:the )?\$|make \$|\$\d[\d,.]*(?:k|\/month| per month|\/mo| worth| gaming studios| email agency)|millionaires|ad accounts|clipping page|tiktok machine|youtube shorts|gurus|course)\b/i.test(
      text
    ) &&
    !/\b(?:playable|game|shader|webgl|three\.?js|3d|open sourcing|source code|github|repo)\b/i.test(text)
  ) {
    return true
  }

  if (media.length && !strongArtifact && !hasPublicEvidence(text)) {
    return true
  }

  return false
}

function isSystemPromptLeakText(text) {
  return (
    /\b(?:system prompt|leaked prompt|prompt leak|full system prompt|hidden instruction|github with \d+[,\d]* stars|pliny the liberator|cl4r1t4s)\b/i.test(
      text
    ) ||
    /(?:系统提示|系統提示|完整提示|提示被完整|隐藏指令|隱藏指令|洩露|泄露|扒出来|曝光|120,000\s*(?:字符|個字符)|1,?5[89]5\s*(?:行|lines))/i.test(
      text
    ) ||
    /(?:sistem komutu|tam sistem|sızdı|sizdi|1\.585\s*satır|1,585\s*satır|şeffaf|seffaf)/i.test(
      text
    )
  )
}

function isMoneyHustleText(text) {
  return (
    /\b(?:printing \$|billing clients|sell it to a studio|full breakdown in the article|course|dm me|comment below|airdrop|farm the|passive income|income funnel|replace my salary|multimillion(?:aire)? company|100 million bonus)\b/i.test(
      text
    ) ||
    /\$\d[\d,]*(?:\/month| subscription|k\/month|,000)/i.test(text) ||
    /\b(?:salario|empresa multimillonaria|bono de 100 millones|despidieran|reemplazar mi salario|remplazar mi salario)\b/i.test(text) ||
    /\b(?:\$\d+k product|pay for|studios|publishers|film companies|token|solana:[a-z0-9]+)\b/i.test(text)
  )
}

function isShowcaseCandidate(post) {
  if (!post?.url || !post?.author || !post?.text) return false
  if (isSystemPromptLeakText(post.text)) return false
  if (isMoneyHustleText(post.text)) return false
  if (post.sourceMode === 'seed-conversation' && !/\b(?:claude|fable|mythos)\b/i.test(post.text)) return false
  if (looksLikeThreadIndex(post.text)) return false
  if (isWeakTextOnlyClaim(post)) return false
  if (isNonCaseAnnouncement(post)) return false
  if (hasStrongArtifactEvidence(post)) return true
  if (hasCaseEvidence(post)) return true
  return linkedItems(post).some((item) => hasCaseEvidence(item) && !isWeakTextOnlyClaim(item) && !isNonCaseAnnouncement(item))
}

function curationDecision(post) {
  const override = post?.url ? curationOverrides.get(post.url) : null
  if (override?.decision === 'keep') return { keep: true, reason: `override-keep: ${override.reason}` }
  if (override?.decision === 'drop') return { keep: false, reason: `override-drop: ${override.reason}` }
  if (!post?.url || !post?.author || !post?.text) return { keep: false, reason: 'missing-url-author-or-text' }
  if (isSystemPromptLeakText(post.text)) return { keep: false, reason: 'system-prompt-leak-or-analysis' }
  if (isMoneyHustleText(post.text)) return { keep: false, reason: 'money-hustle-or-hypothetical-prompt' }
  if (post.sourceMode === 'seed-conversation' && !/\b(?:claude|fable|mythos)\b/i.test(post.text)) {
    return { keep: false, reason: 'thread-reply-not-about-fable' }
  }
  if (looksLikeThreadIndex(post.text)) return { keep: false, reason: 'roundup-or-thread-index' }
  if (isWeakTextOnlyClaim(post)) return { keep: false, reason: 'weak-text-only-or-no-public-evidence' }
  if (isNonCaseAnnouncement(post)) return { keep: false, reason: 'news-platform-announcement-or-marketing' }
  if (hasStrongArtifactEvidence(post)) return { keep: true, reason: 'has-strong-artifact-evidence' }
  if (hasCaseEvidence(post)) return { keep: true, reason: 'has-visible-case-evidence' }
  if (linkedItems(post).some((item) => hasCaseEvidence(item) && !isWeakTextOnlyClaim(item) && !isNonCaseAnnouncement(item))) {
    return { keep: true, reason: 'linked-item-has-case-evidence' }
  }
  return { keep: false, reason: 'no-concrete-case-evidence' }
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
    text: item?.originalText || '',
    date: item?.date || '',
    media: Array.isArray(item?.mediaUrls) ? item.mediaUrls.map((url) => ({ url, type: item.media || 'image' })) : [],
  }
}

function passesFinalNegativeFilter(item) {
  const post = itemAsPost(item)
  const text = post.text || ''
  const combined = `${item.title || ''} ${text}`.toLowerCase()
  if (/\bfable 5 benchmark results compared with other models\b/i.test(item.title || '')) return false
  if (/\b(?:artificial analysis intelligence index|epoch capabilities index|swe-bench|terminal bench|benchmark ranking|rubric score)\b/i.test(text)) {
    return false
  }
  if (isSystemPromptLeakText(text)) return false
  if (isMoneyHustleText(text)) return false
  if (/\b(?:available on|now fully available on|announcing|launching)\b/i.test(combined) && /\b(?:benchmark|platform|model|ainft|fusion lane)\b/i.test(combined)) {
    return false
  }
  if (
    /\b(?:government|national security|foreign national|data retention|zero data retention|microsoft restricted|disabled access|cut off|ordered anthropic|switched both models off|now generally available|rolling out in|now available in|now available on|now live in|now live on|officially available|web chat|premium model|api rollout|pricing is computed)\b/i.test(
      text
    )
  ) {
    return false
  }
  if (looksLikeThreadIndex(post.text)) return false
  if (isWeakTextOnlyClaim(post)) return false
  if (isNonCaseAnnouncement(post)) return false
  return true
}

function normalizeExistingItem(item) {
  const text = item.originalText || item.title || ''
  const media = item.media || 'text'
  return {
    ...item,
    title: titleFromText(text),
    summary: summaryFromText(text, media),
    scene: sceneFor(text),
    categories: categoriesFor(text),
    tags: tagsFor(text),
    facets: facetFields({ ...item, text }, media),
  }
}

function heat(post) {
  const m = post.metrics || {}
  const likes = Number(m.likes || 0)
  const reposts = Number(m.reposts || 0)
  if (likes || reposts) return `${likes.toLocaleString()} likes · ${reposts.toLocaleString()} reposts`
  return 'X post'
}

function cacheMediaPreview(item) {
  if (!CACHE_ASSETS) return item
  const remoteUrl = item.mediaUrls?.[0]
  if (!remoteUrl) return item
  mkdirSync(PUBLIC_MEDIA_DIR, { recursive: true })
  const fileName = `${item.id}.jpg`
  const abs = join(PUBLIC_MEDIA_DIR, fileName)
  const publicPath = `/fable5-media/${fileName}`
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
  const publicPath = `/fable5-avatars/${fileName}`
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
    media: mediaKind(post),
    heat: heat(post),
    tags: tagsFor(post.text),
    verification: `Fetched from X via twitter-cli from ${post.sourceMode || 'search'}; original author and post URL preserved.`,
    promptStatus: status,
    prompt: promptFromPost(post),
    note:
      status === 'prompted'
        ? 'Prompt text was extracted from the original post. Verify any hidden follow-up steps before treating it as a tutorial.'
        : 'Original post did not expose a complete repeatable prompt. Treat this as a real showcase post, not a verified tutorial.',
    originalText: post.text,
    metrics: post.metrics || {},
    mediaUrls: Array.isArray(post.media) ? post.media.map((item) => item.url).filter(Boolean) : [],
    firstSeenAt: generatedAt,
    lastFetchedAt: generatedAt,
    fetchRuns: [sourceRun],
  }
  item.summary = summaryFromText(post.text, item.media)
  item.facets = facetFields(post, item.media)
  if (!options.cacheMedia) return item
  return cacheAvatar(cacheMediaPreview(item), post)
}

const args = parseArgs(process.argv.slice(2))
const explicitLimit = args.limit != null
const limit = explicitLimit ? Math.max(1, Math.min(Number(args.limit), 5000)) : Number.POSITIVE_INFINITY
const cacheMedia = flag(args['cache-media'], true)
const cacheFrom = String(args['cache-from'] || '')
const reviewLimit = Math.max(1, Math.min(Number(args['review-drops'] || 40), 200))
CACHE_ASSETS = args['cache-assets'] !== '0'

const generatedAt = new Date().toISOString()
const batches = loadInputBatches(args)
const allPosts = batches.flatMap((batch) => batch.posts)
const curationOverrides = loadCurationOverrides()
let existingShowcases = []
try {
  const index = JSON.parse(readFileSync(join(OUT_DIR, 'index.json'), 'utf8'))
  for (const shard of index.shards || []) {
    if (shard.file) previousShardFiles.push(shard.file)
    const items = JSON.parse(readFileSync(join(OUT_DIR, shard.file), 'utf8'))
    if (Array.isArray(items)) existingShowcases.push(...items)
  }
} catch {}

const candidateByUrl = new Map()
const curationByUrl = new Map()
const blockedUrls = new Set()
const hardRejectReasons = new Set(['weak-text-only-or-no-public-evidence', 'news-platform-announcement-or-marketing', 'roundup-or-thread-index'])
for (const batch of batches) {
  for (const post of batch.posts) {
    const decision = curationDecision(post)
    if (post?.url && !curationByUrl.has(post.url)) curationByUrl.set(post.url, { post: { ...post, sourceRun: batch.sourceRun }, decision })
    if (post?.url && !decision.keep && hardRejectReasons.has(decision.reason)) {
      blockedUrls.add(post.url)
      candidateByUrl.delete(post.url)
    }
    if (post?.url && blockedUrls.has(post.url)) continue
    if (!decision.keep) continue
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
const existingByUrl = new Map()
for (const item of existingShowcases) {
  if (item?.sourceUrl) existingByUrl.set(item.sourceUrl, normalizeExistingItem(item))
}
for (const item of selected) {
  if (blockedUrls.has(item.sourceUrl)) continue
  const prev = byUrl.get(item.sourceUrl) || existingByUrl.get(item.sourceUrl)
  byUrl.set(item.sourceUrl, {
    ...prev,
    ...item,
    firstSeenAt: prev?.firstSeenAt || item.firstSeenAt,
    lastFetchedAt: generatedAt,
    fetchRuns: [...new Set([...(prev?.fetchRuns || []), ...(item.fetchRuns || [])])],
    mediaThumbUrl: item.mediaThumbUrl || prev?.mediaThumbUrl || '',
  })
}

const collection = [...byUrl.values()].filter((item) => !blockedUrls.has(item.sourceUrl) && passesFinalNegativeFilter(item)).sort((a, b) => {
  const scoreA = scoreMetrics(a.metrics || {})
  const scoreB = scoreMetrics(b.metrics || {})
  return String(b.date || '').localeCompare(String(a.date || '')) || scoreB - scoreA
}).slice(0, limit)

const creators = new Map()
const keywords = new Map()
for (const post of allPosts) {
  if (post?.url && blockedUrls.has(post.url)) continue
  if (!curationDecision(post).keep) continue

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

function sortCategoryCounts(entries) {
  return entries.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a[0])
    const bi = CATEGORY_ORDER.indexOf(b[0])
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    return b[1] - a[1]
  })
}

function writeJsonIfChanged(filePath, value) {
  const next = JSON.stringify(value, null, 2) + '\n'
  try {
    if (readFileSync(filePath, 'utf8') === next) return false
  } catch {}
  writeFileSync(filePath, next)
  return true
}

mkdirSync(OUT_DIR, { recursive: true })
const CHUNK_DIR = join(OUT_DIR, 'chunks')
const PAGE_DIR = join(OUT_DIR, 'pages')
mkdirSync(CHUNK_DIR, { recursive: true })
mkdirSync(PAGE_DIR, { recursive: true })
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
const changedShards = shardList.filter((shard) => writeJsonIfChanged(join(OUT_DIR, shard.file), shardMap.get(shard.date)))
const activeShardFiles = new Set(shardList.map((shard) => shard.file))
for (const file of previousShardFiles) {
  if (activeShardFiles.has(file)) continue
  rmSync(join(OUT_DIR, file), { force: true })
}
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
const categoryCounts = new Map()
for (const item of collection) {
  const categories = Array.isArray(item.categories) && item.categories.length ? item.categories : [item.scene || 'other']
  for (const key of categories) categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1)
}
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
console.log(`Loaded ${allPosts.length} archived posts from ${batches.length} runs`)
console.log(`Merged ${selected.length} local showcase candidates into ${collection.length} total cards and ${creatorPool.length} creators at ${OUT_DIR}`)
console.log(`Shards: ${shardList.map((s) => `${s.date}(${s.count})`).join(' ')}; rewrote ${changedShards.length} shard file(s)`)
