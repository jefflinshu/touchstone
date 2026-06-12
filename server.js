import express from 'express'
import { WebSocketServer } from 'ws'
import { spawn, execFile } from 'node:child_process'
import { createServer } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import os from 'node:os'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUNS_DIR = path.join(__dirname, 'runs')
const DATA_DIR = path.join(__dirname, 'data')
const REGISTRY_FILE = path.join(DATA_DIR, 'runs.json')
const AGENTS_FILE = path.join(__dirname, 'agents.json')
const PORT = process.env.PORT || 3000
const SITE_NAME = 'Touchstone'
const SITE_DESCRIPTION =
  'Touchstone 是一个多模型 AI coding 作品对比平台，用同一个 prompt 同时运行 Codex、Claude、Gemini 等 coding agent，并展示可交互作品、提示词、运行指标和社区案例。'
const DEFAULT_SOCIAL_IMAGE = '/fable5-media/meta_alchemist-2064431279383433646.jpg'

fs.mkdirSync(RUNS_DIR, { recursive: true })
fs.mkdirSync(DATA_DIR, { recursive: true })

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeXml(value) {
  return escapeHtml(value).replace(/'/g, '&apos;')
}

function cleanText(value, max = 180) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function requestOrigin(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http'
  return `${proto}://${req.get('host')}`
}

function publicPath(pathname) {
  return pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
}

function latestIso(list) {
  return list.reduce((max, item) => {
    const at = item.endedAt || item.createdAt || ''
    return at > max ? at : max
  }, '')
}

function seoForPath(req) {
  const origin = requestOrigin(req)
  let pathname = publicPath(req.path || '/')
  let title = `${SITE_NAME} · AI Coding Arena`
  let description = SITE_DESCRIPTION
  let type = 'WebSite'

  if (pathname === '/fable5') {
    title = 'Claude Fable 5 Prompts & Showcases · Touchstone'
    description = '浏览 Claude Fable 5 社区真实案例、热门 prompt、网页、游戏、设计、动画等分类作品，并复制可复用提示词。'
    type = 'CollectionPage'
  } else {
    const projectMatch = pathname.match(/^\/p\/([^/]+)$/)
    const userMatch = pathname.match(/^\/u\/([^/]+)$/)
    if (projectMatch) {
      const project = decodeURIComponent(projectMatch[1])
      const projectRuns = runs.filter((r) => r.project === project)
      const latest = projectRuns[projectRuns.length - 1]
      title = `${project} · Touchstone Case`
      const prompt = latest?.prompt ? `Prompt: ${cleanText(latest.prompt, 120)}` : '查看这个 AI coding case 的多模型作品对比。'
      description = `${prompt}${latest?.prompt?.length > 120 ? '...' : ''} ${projectRuns.length || ''} runs across ${
        new Set(projectRuns.map((r) => r.agentName)).size || 'multiple'
      } agents.`.trim()
      type = 'CreativeWork'
    } else if (userMatch) {
      const email = decodeURIComponent(userMatch[1])
      const profile = users[email] || {}
      const name = profile.name || email
      title = `${name} · Touchstone Profile`
      description = cleanText(profile.bio, 180) || `查看 ${name} 在 Touchstone 发布和参与的 AI coding cases。`
      type = 'ProfilePage'
    }
  }

  const canonical = `${origin}${pathname}`
  const image = `${origin}${DEFAULT_SOCIAL_IMAGE}`
  return {
    title,
    description,
    canonical,
    image,
    type,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': type,
      name: title,
      description,
      url: canonical,
      image,
      inLanguage: 'zh-CN',
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: origin },
    },
  }
}

function replaceMeta(html, selector, attrs) {
  const attrString = Object.entries(attrs)
    .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
    .join(' ')
  const tag = `<meta ${attrString} />`
  const pattern =
    selector.kind === 'name'
      ? new RegExp(`<meta[^>]+name=["']${selector.value}["'][^>]*>`, 'i')
      : new RegExp(`<meta[^>]+property=["']${selector.value}["'][^>]*>`, 'i')
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

function renderSeoHtml(html, seo) {
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`)
  out = replaceMeta(out, { kind: 'name', value: 'description' }, { name: 'description', content: seo.description })
  out = replaceMeta(out, { kind: 'property', value: 'og:title' }, { property: 'og:title', content: seo.title })
  out = replaceMeta(out, { kind: 'property', value: 'og:description' }, { property: 'og:description', content: seo.description })
  out = replaceMeta(out, { kind: 'property', value: 'og:url' }, { property: 'og:url', content: seo.canonical })
  out = replaceMeta(out, { kind: 'property', value: 'og:image' }, { property: 'og:image', content: seo.image })
  out = replaceMeta(out, { kind: 'property', value: 'og:type' }, { property: 'og:type', content: seo.type === 'CreativeWork' ? 'article' : seo.type === 'ProfilePage' ? 'profile' : 'website' })
  out = replaceMeta(out, { kind: 'name', value: 'twitter:title' }, { name: 'twitter:title', content: seo.title })
  out = replaceMeta(out, { kind: 'name', value: 'twitter:description' }, { name: 'twitter:description', content: seo.description })
  out = replaceMeta(out, { kind: 'name', value: 'twitter:image' }, { name: 'twitter:image', content: seo.image })
  const canonicalTag = `<link rel="canonical" href="${escapeHtml(seo.canonical)}" />`
  out = /<link[^>]+rel=["']canonical["'][^>]*>/i.test(out)
    ? out.replace(/<link[^>]+rel=["']canonical["'][^>]*>/i, canonicalTag)
    : out.replace('</head>', `    ${canonicalTag}\n  </head>`)
  const jsonLd = `<script type="application/ld+json">${JSON.stringify(seo.jsonLd)}</script>`
  return /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i.test(out)
    ? out.replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i, jsonLd)
    : out.replace('</head>', `    ${jsonLd}\n  </head>`)
}

// ---------- 配置与注册表 ----------

function loadAgentsConfig() {
  return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'))
}

// ---------- 实际执行模型识别 ----------
// 用户没有显式选模型时：优先从运行日志解析（codex 会打印 model: xxx），
// 否则回退到各 CLI 本地配置文件里的默认模型
const MODEL_LOG_PATTERNS = {
  codex: /^\s*model:\s*(\S+)\s*$/m,
}

function probeDefaultModel(agentId) {
  try {
    if (agentId === 'codex') {
      const t = fs.readFileSync(path.join(os.homedir(), '.codex', 'config.toml'), 'utf8')
      return t.match(/^\s*model\s*=\s*"([^"]+)"/m)?.[1] || null
    }
    if (agentId === 'claude') {
      const j = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'settings.json'), 'utf8'))
      return typeof j.model === 'string' ? j.model : null
    }
    if (agentId === 'gemini') {
      const j = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.gemini', 'settings.json'), 'utf8'))
      return typeof j.model === 'string' ? j.model : j.model?.name || null
    }
  } catch {}
  return null
}

// 从本地 CLI 配置读取该 CLI 已知的模型（默认模型排第一）
function probeLocalModels(agentId) {
  const out = []
  try {
    if (agentId === 'codex') {
      const t = fs.readFileSync(path.join(os.homedir(), '.codex', 'config.toml'), 'utf8')
      const def = t.match(/^\s*model\s*=\s*"([^"]+)"/m)?.[1]
      if (def) out.push(def)
      const sec = t.match(/\[tui\.model_availability_nux\]([\s\S]*?)(?=\n\[|$)/)
      if (sec) {
        for (const m of sec[1].matchAll(/^\s*"?([\w.\-/]+)"?\s*=/gm)) out.push(m[1])
      }
    } else {
      const def = probeDefaultModel(agentId)
      if (def) out.push(def)
    }
  } catch {}
  return out
}

function detectModelFromLog(run) {
  const pattern = MODEL_LOG_PATTERNS[run.agentId]
  if (!pattern) return null
  try {
    const log = fs.readFileSync(path.join(RUNS_DIR, run.folder, '.touchstone.log'), 'utf8')
    return log.match(pattern)?.[1] || null
  } catch {
    return null
  }
}

// ---------- 运行指标：token 消耗 / 工具调用次数 / 成本 ----------
// claude、gemini 走 JSON 输出格式自带 usage；codex 从日志解析
function parseMetrics(run) {
  let log
  try {
    log = fs.readFileSync(path.join(RUNS_DIR, run.folder, '.touchstone.log'), 'utf8')
  } catch {
    return null
  }
  try {
    if (run.agentId === 'codex') {
      const tok = log.match(/tokens used\s*:?\s*\n?\s*([\d,]+)/i)
      const tools = (log.match(/^exec\b/gm) || []).length
      if (!tok && !tools) return null
      return {
        tokens: tok ? parseInt(tok[1].replace(/,/g, ''), 10) : null,
        toolCalls: tools || null,
        costUsd: null,
      }
    }
    // claude / gemini：取日志末尾的 JSON 对象
    const start = log.lastIndexOf('\n{')
    const end = log.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    const j = JSON.parse(log.slice(start + 1, end + 1))
    if (run.agentId === 'claude') {
      const u = j.usage || {}
      const tokens =
        (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0)
      return { tokens: tokens || null, toolCalls: j.num_turns ?? null, costUsd: j.total_cost_usd ?? null }
    }
    if (run.agentId === 'gemini') {
      const models = j.stats?.models || {}
      let tokens = 0
      for (const k of Object.keys(models)) tokens += models[k]?.tokens?.total || 0
      return { tokens: tokens || null, toolCalls: j.stats?.tools?.totalCalls ?? null, costUsd: null }
    }
  } catch {}
  return null
}

let runs = []
if (fs.existsSync(REGISTRY_FILE)) {
  try {
    runs = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'))
  } catch {
    runs = []
  }
}
// 服务重启后，残留的 running 状态标记为 interrupted
for (const r of runs) {
  if (r.status === 'running' || r.status === 'pending') {
    r.status = 'interrupted'
    r.endedAt = r.endedAt || new Date().toISOString()
  }
  // 历史记录回填实际执行模型
  if (!r.model && !r.resolvedModel) {
    r.resolvedModel = detectModelFromLog(r) || probeDefaultModel(r.agentId)
  }
  // 历史记录回填运行指标
  if (!r.metrics && (r.status === 'done' || r.status === 'failed')) {
    r.metrics = parseMetrics(r)
  }
}

let saveTimer = null
function saveRegistry() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(runs, null, 2))
  }, 200)
}
saveRegistry()

// ---------- 浏览量 / 点赞 ----------
const STATS_FILE = path.join(DATA_DIR, 'stats.json')
let stats = { views: {}, likes: {}, projectLikes: {} }
if (fs.existsSync(STATS_FILE)) {
  try {
    stats = { views: {}, likes: {}, projectLikes: {}, ...JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) }
  } catch {}
}
let statsTimer = null
function saveStats() {
  clearTimeout(statsTimer)
  statsTimer = setTimeout(() => fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2)), 200)
}

// ---------- WebSocket ----------

const app = express()
const httpServer = createServer(app)
const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

function broadcast(msg) {
  const data = JSON.stringify(msg)
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data)
  }
}

// ---------- 工具函数 ----------

function slugify(name) {
  return (
    String(name)
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[\\/:*?"<>|]/g, '')
      .slice(0, 60) || 'untitled'
  )
}

// 在 run 目录中寻找浏览器可打开的作品入口（优先根目录 index.html，其次最浅层的 .html）
function findEntry(folder) {
  const dir = path.join(RUNS_DIR, folder)
  if (!fs.existsSync(dir)) return null
  const rootIndex = path.join(dir, 'index.html')
  if (fs.existsSync(rootIndex)) return 'index.html'
  const queue = [{ rel: '', depth: 0 }]
  const htmls = []
  while (queue.length) {
    const { rel, depth } = queue.shift()
    if (depth > 3) continue
    let entries = []
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue
      const rp = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) queue.push({ rel: rp, depth: depth + 1 })
      else if (e.name.toLowerCase().endsWith('.html')) htmls.push({ rp, depth })
    }
  }
  if (!htmls.length) return null
  htmls.sort((a, b) => a.depth - b.depth || (a.rp.endsWith('index.html') ? -1 : 1))
  return htmls[0].rp
}

function listFiles(folder) {
  const dir = path.join(RUNS_DIR, folder)
  const out = []
  function walk(rel, depth) {
    if (depth > 4 || out.length > 500) return
    let entries = []
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue
      const rp = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) {
        out.push({ path: rp, dir: true })
        walk(rp, depth + 1)
      } else {
        let size = 0
        try {
          size = fs.statSync(path.join(dir, rp)).size
        } catch {}
        out.push({ path: rp, dir: false, size })
      }
    }
  }
  walk('', 0)
  return out
}

function publicRun(r) {
  const { proc, ...rest } = r
  return { ...rest, likes: stats.likes[r.id] || 0 }
}

// ---------- 作品截图（folder 卡片缩略图，本机 Chrome headless，无额外依赖） ----------
const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]
const chromeBin = CHROME_PATHS.find((p) => fs.existsSync(p))
const PREVIEW_FILE = '.touchstone-preview.png'

const previewPath = (run) => path.join(RUNS_DIR, run.folder, PREVIEW_FILE)

// 截图串行队列，避免同时拉起多个 Chrome
let shotQueue = Promise.resolve()
function capturePreview(run) {
  if (!chromeBin || !run.entry) return
  shotQueue = shotQueue
    .then(
      () =>
        new Promise((resolve) => {
          const out = previewPath(run)
          const folderPath = run.folder.split('/').map(encodeURIComponent).join('/')
          const url = `http://localhost:${PORT}/workspace/${folderPath}/${run.entry}`
          execFile(
            chromeBin,
            [
              '--headless=new',
              '--disable-gpu',
              '--hide-scrollbars',
              '--window-size=1280,800',
              '--virtual-time-budget=6000',
              `--screenshot=${out}`,
              url,
            ],
            { timeout: 45000 },
            () => {
              if (fs.existsSync(out)) {
                run.preview = true
                saveRegistry()
                broadcast({ type: 'run', run: publicRun(run) })
              }
              resolve()
            }
          )
        })
    )
    .catch(() => {})
}

// ---------- 任务分类（vibe coding 方向：ui/game/3d/viz/tool/ios/other） ----------
const CATEGORIES = ['ui', 'game', '3d', 'viz', 'tool', 'ios', 'other']

function classifyHeuristic(prompt) {
  const p = (prompt || '').toLowerCase()
  if (/game|游戏|贪吃蛇|俄罗斯方块|snake|tetris|puzzle|arcade|关卡|得分|player/.test(p)) return 'game'
  if (/three\.?js|webgl|shader|\b3d\b|三维|立体场景/.test(p)) return '3d'
  if (/chart|图表|可视化|dashboard|仪表盘|数据分析|\bviz\b|plot/.test(p)) return 'viz'
  if (/\bios\b|swiftui|swift|iphone|ipad|安卓|android/.test(p)) return 'ios'
  if (/工具|converter|转换器|计算器|calculator|todo|清单|生成器|generator/.test(p)) return 'tool'
  if (/页面|界面|\bui\b|landing|网站|website|组件|动画|时钟|clock|css|卡片|海报/.test(p)) return 'ui'
  return 'other'
}

// ---------- Git 自动提交 ----------
// 任务完成后把该项目的作品 commit 进仓库（agents.json defaults.git 可关闭），
// 队列串行执行，避免并发任务争抢 git index
const execGit = (args) =>
  new Promise((resolve) =>
    execFile('git', args, { cwd: __dirname }, (error, stdout, stderr) => resolve({ error, stdout, stderr }))
  )

let gitQueue = Promise.resolve()

function autoCommitRun(run) {
  const gitCfg = loadAgentsConfig().defaults.git || {}
  if (gitCfg.autoCommit === false) return
  gitQueue = gitQueue
    .then(async () => {
      if (!fs.existsSync(path.join(__dirname, '.git'))) return
      await execGit(['add', '--', path.join('runs', run.folder)])
      const model = run.model || run.resolvedModel
      const msg = `showcase(${run.project}): add ${run.agentName}${model ? ` (${model})` : ''} run`
      const { error } = await execGit(['commit', '-m', msg])
      if (!error && gitCfg.autoPush !== false) {
        const { error: pushErr } = await execGit(['push'])
        if (pushErr) console.error('[git] push 失败：', String(pushErr).split('\n')[0])
      }
    })
    .catch((e) => console.error('[git] 自动提交失败：', e))
}

// ---------- 任务执行 ----------

const liveProcs = new Map() // runId -> ChildProcess

function startRun(run, agent, prompt, timeoutMinutes) {
  const dir = path.join(RUNS_DIR, run.folder)
  fs.mkdirSync(dir, { recursive: true })
  const logFile = path.join(dir, '.touchstone.log')

  const args = agent.args.map((a) => a.replaceAll('{{PROMPT}}', prompt))
  if (run.model && agent.modelFlag) args.push(agent.modelFlag, run.model)
  const startNote = `$ ${agent.command} ${args.map((a) => (a.length > 200 ? a.slice(0, 200) + '…' : a)).join(' ')}\n\n`
  fs.writeFileSync(logFile, startNote)

  run.status = 'running'
  run.startedAt = new Date().toISOString()
  saveRegistry()
  broadcast({ type: 'run', run: publicRun(run) })

  let proc
  try {
    proc = spawn(agent.command, args, {
      cwd: dir,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    run.status = 'failed'
    run.endedAt = new Date().toISOString()
    run.error = String(err)
    saveRegistry()
    broadcast({ type: 'run', run: publicRun(run) })
    return
  }

  liveProcs.set(run.id, proc)

  const onChunk = (buf) => {
    const text = buf.toString('utf8')
    fs.appendFileSync(logFile, text)
    broadcast({ type: 'log', runId: run.id, chunk: text })
    // 运行过程中可能已经产出了 html，顺手刷新入口
    const entry = findEntry(run.folder)
    if (entry !== run.entry) {
      run.entry = entry
      saveRegistry()
      broadcast({ type: 'run', run: publicRun(run) })
    }
  }
  proc.stdout.on('data', onChunk)
  proc.stderr.on('data', onChunk)

  const timeout = setTimeout(() => {
    fs.appendFileSync(logFile, `\n[touchstone] 超过 ${timeoutMinutes} 分钟超时，已终止\n`)
    proc.kill('SIGKILL')
    run.timedOut = true
  }, timeoutMinutes * 60 * 1000)

  proc.on('close', (code) => {
    clearTimeout(timeout)
    liveProcs.delete(run.id)
    run.exitCode = code
    run.endedAt = new Date().toISOString()
    run.entry = findEntry(run.folder)
    if (!run.model) run.resolvedModel = detectModelFromLog(run) || run.resolvedModel
    run.metrics = parseMetrics(run)
    if (run.status === 'stopped') {
      // 用户手动停止，保持 stopped
    } else if (run.timedOut) {
      run.status = 'failed'
      run.error = '执行超时'
    } else {
      run.status = code === 0 ? 'done' : 'failed'
    }
    fs.appendFileSync(logFile, `\n[touchstone] 进程退出，exit code = ${code}\n`)
    saveRegistry()
    broadcast({ type: 'run', run: publicRun(run) })
    if (run.status === 'done') {
      capturePreview(run)
      if (run.publish) autoCommitRun(run)
    }
  })

  proc.on('error', (err) => {
    fs.appendFileSync(logFile, `\n[touchstone] 启动失败: ${err}\n`)
  })
}

// ---------- API ----------

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'touchstone',
    baseUrl: oauthBaseUrl(req),
    googleOAuthConfigured: googleOAuthReady(),
    uptime: Math.round(process.uptime()),
  })
})

app.get('/api/agents', (req, res) => {
  const cfg = loadAgentsConfig()
  res.json({
    agents: cfg.agents.map((a) => ({
      id: a.id,
      name: a.name,
      color: a.color,
      // 本地配置探测到的模型优先（默认选中），agents.json 列表兜底
      models: [...new Set([...probeLocalModels(a.id), ...(a.models || [])])],
      health: agentHealth(a),
    })),
    defaults: cfg.defaults,
  })
})

// ---------- 项目自动命名 ----------
// 优先 Anthropic API（haiku，便宜快），无 API key 时回退 claude CLI，最后回退时间戳名
const NAMING_PROMPT = (prompt) =>
  `为下面的编程任务起一个 2-4 个英文单词的 kebab-case 短名（如 bouncing-ball-hexagon），并从 [${CATEGORIES.join(', ')}] 中选一个最贴切的分类。只输出一行 JSON（不要 markdown 代码块），形如 {"name":"bouncing-ball-hexagon","category":"ui"}：\n${prompt.slice(0, 500)}`

const cleanName = (raw) =>
  slugify(
    (raw || '').trim().split('\n').filter(Boolean).pop()?.toLowerCase().replace(/[^a-z0-9 _-]/g, '').trim() || ''
  ).slice(0, 40)

// 解析命名输出：优先 JSON（name+category），失败回退纯文本名
function parseNaming(raw) {
  try {
    const m = String(raw || '').match(/\{[\s\S]*\}/)
    if (m) {
      const j = JSON.parse(m[0])
      return { name: cleanName(j.name), category: CATEGORIES.includes(j.category) ? j.category : null }
    }
  } catch {}
  return { name: cleanName(raw), category: null }
}

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

async function nameViaApi(prompt) {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 128,
    messages: [{ role: 'user', content: NAMING_PROMPT(prompt) }],
  })
  return parseNaming(msg.content.find((b) => b.type === 'text')?.text)
}

function nameViaCli(prompt) {
  return new Promise((resolve) => {
    let settled = false
    const done = (v) => {
      if (!settled) {
        settled = true
        resolve(v)
      }
    }
    try {
      const proc = spawn('claude', ['-p', NAMING_PROMPT(prompt), '--model', 'haiku'], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      let out = ''
      proc.stdout.on('data', (d) => (out += d))
      const timer = setTimeout(() => {
        proc.kill('SIGKILL')
        done({ name: '', category: null })
      }, 25000)
      proc.on('close', () => {
        clearTimeout(timer)
        done(parseNaming(out))
      })
      proc.on('error', () => done({ name: '', category: null }))
    } catch {
      done({ name: '', category: null })
    }
  })
}

async function autoNameProject(prompt) {
  let res = { name: '', category: null }
  if (anthropic) {
    try {
      res = await nameViaApi(prompt)
    } catch (err) {
      console.error('[naming] API 失败，回退 CLI：', err?.message)
    }
  }
  if (res.name.length < 2) {
    const cli = await nameViaCli(prompt)
    res = { name: cli.name, category: cli.category || res.category }
  }
  if (res.name.length < 2) {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    res.name = `task-${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  }
  return res
}

// ---------- 本地 CLI 健康检查 ----------
// installed：PATH 中能找到命令；authed：凭据文件/环境变量存在（启发式）
const FIX_HINTS = {
  claude: '终端运行 claude 并完成 /login 登录',
  codex: '终端运行 codex login 完成登录',
  gemini: '终端运行 gemini 完成 Google 账号授权（浏览器登录一次即可）',
}

function checkInstalled(command) {
  const paths = (process.env.PATH || '').split(path.delimiter)
  return paths.some((p) => {
    try {
      fs.accessSync(path.join(p, command), fs.constants.X_OK)
      return true
    } catch {
      return false
    }
  })
}

function checkAuthed(agentId) {
  const home = os.homedir()
  try {
    if (agentId === 'claude') {
      return fs.existsSync(path.join(home, '.claude.json')) || !!process.env.ANTHROPIC_API_KEY
    }
    if (agentId === 'codex') {
      return fs.existsSync(path.join(home, '.codex', 'auth.json'))
    }
    if (agentId === 'gemini') {
      return (
        fs.existsSync(path.join(home, '.gemini', 'oauth_creds.json')) ||
        !!process.env.GEMINI_API_KEY ||
        !!process.env.GOOGLE_API_KEY
      )
    }
  } catch {}
  return true
}

function agentHealth(agent) {
  const installed = checkInstalled(agent.command)
  const authed = installed && checkAuthed(agent.id)
  return {
    installed,
    authed,
    ready: installed && authed,
    fix: !installed ? `未检测到 ${agent.command} 命令，请先安装` : !authed ? FIX_HINTS[agent.id] || '请先完成 CLI 登录' : null,
  }
}

// ---------- Google 登录（标准 OAuth 2.0 Web flow） ----------
const SESSION_FILE = path.join(DATA_DIR, 'session.json')
let session = { sessions: {}, oauthStates: {} }
if (fs.existsSync(SESSION_FILE)) {
  try {
    session = { sessions: {}, oauthStates: {}, ...JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) }
  } catch {}
}
const saveSession = () => fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2))

// 用户资料（头像/昵称），发布者信息展示在 folder 卡片上
const USERS_FILE = path.join(DATA_DIR, 'users.json')
let users = {}
if (fs.existsSync(USERS_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))
  } catch {}
}
const saveUsers = () => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))

// Google 头像直链浏览器端常被网络环境拦截；服务端经代理（curl 读系统代理变量）
// 下载缓存到本地，前端改用本站 /avatars/ 地址
const AVATARS_DIR = path.join(DATA_DIR, 'avatars')
fs.mkdirSync(AVATARS_DIR, { recursive: true })
app.use('/avatars', express.static(AVATARS_DIR, { maxAge: '7d' }))

function localizeAvatar(email, url) {
  return new Promise((resolve) => {
    if (!url || !url.includes('googleusercontent.com')) return resolve(url)
    const file = `${crypto.createHash('sha1').update(url).digest('hex')}.img`
    const abs = path.join(AVATARS_DIR, file)
    const local = `/avatars/${file}`
    if (fs.existsSync(abs) && fs.statSync(abs).size > 0) return resolve(local)
    execFile('curl', ['-s', '--max-time', '15', '-o', abs, url], (err) => {
      if (!err && fs.existsSync(abs) && fs.statSync(abs).size > 0) return resolve(local)
      fs.rmSync(abs, { force: true })
      resolve(url)
    })
  })
}

// 旧数据迁移：把已存的 Google 直链头像换成本地缓存
for (const [email, u] of Object.entries(users)) {
  if (u?.picture?.includes('googleusercontent.com')) {
    localizeAvatar(email, u.picture).then((p) => {
      if (p !== u.picture) {
        users[email].picture = p
        saveUsers()
        broadcast({ type: 'user', email, profile: users[email] })
      }
    })
  }
}

const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile']
const SESSION_COOKIE = 'touchstone_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=')
        if (idx === -1) return [part, '']
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))]
      })
  )
}

function cookieSecure(req) {
  return (req.get('x-forwarded-proto') || req.protocol) === 'https'
}

function setSessionCookie(req, res, sid) {
  const attrs = [`${SESSION_COOKIE}=${encodeURIComponent(sid)}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${SESSION_MAX_AGE_SECONDS}`]
  if (cookieSecure(req)) attrs.push('Secure')
  res.setHeader('Set-Cookie', attrs.join('; '))
}

function clearSessionCookie(req, res) {
  const attrs = [`${SESSION_COOKIE}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0']
  if (cookieSecure(req)) attrs.push('Secure')
  res.setHeader('Set-Cookie', attrs.join('; '))
}

function oauthBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL || process.env.BASE_URL || requestOrigin(req)
}

function googleRedirectUri(req) {
  return process.env.GOOGLE_REDIRECT_URI || new URL('/api/auth/callback', oauthBaseUrl(req)).href
}

function googleOAuthReady() {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
}

function localReturnTo(value) {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/'
  return value
}

function cleanupAuthState() {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [state, item] of Object.entries(session.oauthStates || {})) {
    if (!item?.createdAt || item.createdAt < cutoff) delete session.oauthStates[state]
  }
}

function currentSession(req) {
  const sid = parseCookies(req)[SESSION_COOKIE]
  if (!sid) return null
  const data = session.sessions?.[sid]
  if (!data?.email) return null
  return { sid, ...data }
}

function getGoogleAccount(req) {
  return Promise.resolve(currentSession(req)?.email || null)
}

async function fetchGoogleProfile(accessToken) {
  const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!r.ok) throw new Error(`Google userinfo failed: ${r.status}`)
  const j = await r.json()
  if (!j.email) throw new Error('Google userinfo response did not include email')
  const picture = await localizeAvatar(j.email, j.picture || null)
  users[j.email] = {
    ...users[j.email],
    name: j.name || users[j.email]?.name || j.email.split('@')[0],
    picture,
  }
  saveUsers()
  return { email: j.email, ...users[j.email] }
}

async function exchangeGoogleCode(req, code) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: googleRedirectUri(req),
    grant_type: 'authorization_code',
  })
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error_description || j.error || `Google token exchange failed: ${r.status}`)
  return j
}

app.get('/api/auth/me', async (req, res) => {
  const cur = currentSession(req)
  const profile = cur?.email ? users[cur.email] || { name: cur.name, picture: cur.picture } : {}
  res.json({ loggedIn: !!cur, email: cur?.email || null, ...profile })
})

app.get('/api/auth/login', (req, res) => {
  if (!googleOAuthReady()) {
    return res.status(500).type('text/plain; charset=utf-8').send(
      [
        'Google OAuth 未配置。',
        '请先创建 Web application OAuth client，并设置环境变量：',
        `GOOGLE_REDIRECT_URI=${googleRedirectUri(req)}`,
        'GOOGLE_CLIENT_ID=...',
        'GOOGLE_CLIENT_SECRET=...',
      ].join('\n')
    )
  }
  cleanupAuthState()
  const state = crypto.randomBytes(24).toString('base64url')
  session.oauthStates[state] = { createdAt: Date.now(), returnTo: localReturnTo(req.query.returnTo) }
  saveSession()
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID)
  url.searchParams.set('redirect_uri', googleRedirectUri(req))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_OAUTH_SCOPES.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'select_account')
  res.redirect(url.href)
})

app.post('/api/auth/login', (req, res) => {
  res.json({ authUrl: `/api/auth/login?returnTo=${encodeURIComponent(localReturnTo(req.body?.returnTo))}` })
})

app.get('/api/auth/callback', async (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const pending = session.oauthStates?.[state]
  delete session.oauthStates?.[state]
  saveSession()
  if (!pending) return res.status(400).type('text/plain; charset=utf-8').send('Google OAuth state 无效或已过期，请重新登录。')
  if (req.query.error) return res.status(400).type('text/plain; charset=utf-8').send(`Google OAuth 失败：${req.query.error}`)
  try {
    const token = await exchangeGoogleCode(req, String(req.query.code || ''))
    const profile = await fetchGoogleProfile(token.access_token)
    const sid = crypto.randomBytes(32).toString('base64url')
    session.sessions[sid] = { email: profile.email, name: profile.name, picture: profile.picture, createdAt: Date.now() }
    saveSession()
    setSessionCookie(req, res, sid)
    res.redirect(pending.returnTo || '/')
  } catch (err) {
    console.error('[auth] Google OAuth callback failed:', err)
    res.status(500).type('text/plain; charset=utf-8').send(`Google OAuth 回调失败：${err?.message || err}`)
  }
})

app.post('/api/auth/logout', (req, res) => {
  const sid = parseCookies(req)[SESSION_COOKIE]
  if (sid) delete session.sessions?.[sid]
  saveSession()
  clearSessionCookie(req, res)
  res.json({ loggedIn: false })
})

// GitHub stars：服务端经代理拉取，缓存 1 小时
const GITHUB_REPO = 'jefflinshu/touchstone'
let repoCache = { at: 0, stars: null }
app.get('/api/repo', (req, res) => {
  if (repoCache.stars !== null && Date.now() - repoCache.at < 3600000) {
    return res.json({ repo: GITHUB_REPO, stars: repoCache.stars })
  }
  execFile('curl', ['-s', '--max-time', '10', `https://api.github.com/repos/${GITHUB_REPO}`], (err, out) => {
    if (!err) {
      try {
        const n = JSON.parse(out).stargazers_count
        if (typeof n === 'number') repoCache = { at: Date.now(), stars: n }
      } catch {}
    }
    res.json({ repo: GITHUB_REPO, stars: repoCache.stars })
  })
})

app.post('/api/tasks', async (req, res) => {
  const { prompt, runners, publish } = req.body || {}
  let { project } = req.body || {}
  if (!prompt || !Array.isArray(runners) || runners.length === 0) {
    return res.status(400).json({ error: 'prompt 和至少一个 runner 必填' })
  }
  const user = await getGoogleAccount(req)
  if (!user) {
    return res.status(401).json({ error: '请先登录 Google 账号' })
  }
  const cfg = loadAgentsConfig()
  let category = null
  if (!project || !String(project).trim()) {
    const named = await autoNameProject(prompt)
    project = named.name
    category = named.category
  }
  if (!category) category = classifyHeuristic(prompt)
  // 交付要求强制附加：网站展示依赖 index.html
  const finalPrompt = prompt + cfg.defaults.artifactHint
  const batchId = crypto.randomUUID()
  const created = []

  for (const r of runners) {
    const agent = cfg.agents.find((a) => a.id === r?.agentId)
    if (!agent) continue
    const model = typeof r.model === 'string' ? r.model.trim() : ''
    // 目录结构：runs/<项目>/<模型>，同名冲突时追加 _2、_3…
    const projectSlug = slugify(project)
    const base = model ? `${agent.id}-${slugify(model)}` : agent.id
    let sub = base
    for (let n = 2; fs.existsSync(path.join(RUNS_DIR, projectSlug, sub)); n++) sub = `${base}_${n}`
    const folder = `${projectSlug}/${sub}`
    const run = {
      id: crypto.randomUUID(),
      batchId,
      agentId: agent.id,
      agentName: agent.name,
      model: model || null,
      resolvedModel: model ? null : probeDefaultModel(agent.id),
      color: agent.color,
      project: String(project).trim(),
      prompt,
      folder,
      entry: null,
      status: 'pending',
      publish: !!publish,
      user,
      category,
      createdAt: new Date().toISOString(),
    }
    runs.unshift(run)
    created.push(run)
    startRun(run, agent, finalPrompt, cfg.defaults.timeoutMinutes || 20)
  }
  saveRegistry()
  res.json({ batchId, project, runs: created.map(publicRun) })
})

app.get('/api/runs', (req, res) => {
  res.json({ runs: runs.map(publicRun), views: stats.views, projectLikes: stats.projectLikes, users })
})

// 项目（case）级点赞
app.post('/api/projects/:project/like', (req, res) => {
  const project = req.params.project
  const delta = req.body?.action === 'unlike' ? -1 : 1
  stats.projectLikes[project] = Math.max(0, (stats.projectLikes[project] || 0) + delta)
  saveStats()
  broadcast({ type: 'projectLike', project, likes: stats.projectLikes[project] })
  res.json({ likes: stats.projectLikes[project] })
})

// 登录用户修改自己的昵称 / bio / 头像
app.post('/api/users/me', async (req, res) => {
  const email = await getGoogleAccount(req)
  if (!email) return res.status(401).json({ error: '请先登录 Google 账号' })
  const { name, bio, picture } = req.body || {}
  const cur = users[email] || {}
  const nextPicture = typeof picture === 'string' ? picture.trim() || null : cur.picture || null
  users[email] = {
    ...cur,
    name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 40) : cur.name || email.split('@')[0],
    bio: typeof bio === 'string' ? bio.trim().slice(0, 500) : cur.bio || '',
    picture: await localizeAvatar(email, nextPicture),
  }
  saveUsers()
  broadcast({ type: 'user', email, profile: users[email] })
  res.json({ email, ...users[email] })
})

app.post('/api/projects/:project/view', (req, res) => {
  const project = req.params.project
  stats.views[project] = (stats.views[project] || 0) + 1
  saveStats()
  broadcast({ type: 'view', project, views: stats.views[project] })
  res.json({ views: stats.views[project] })
})

app.post('/api/runs/:id/like', (req, res) => {
  const run = runs.find((r) => r.id === req.params.id)
  if (!run) return res.status(404).json({ error: 'not found' })
  const delta = req.body?.action === 'unlike' ? -1 : 1
  stats.likes[run.id] = Math.max(0, (stats.likes[run.id] || 0) + delta)
  saveStats()
  broadcast({ type: 'run', run: publicRun(run) })
  res.json({ likes: stats.likes[run.id] })
})

app.get('/api/runs/:id/preview', (req, res) => {
  const run = runs.find((r) => r.id === req.params.id)
  if (!run) return res.status(404).json({ error: 'not found' })
  const f = previewPath(run)
  if (!fs.existsSync(f)) return res.status(404).json({ error: 'no preview' })
  res.setHeader('Cache-Control', 'no-store')
  res.type('png').send(fs.readFileSync(f))
})

app.get('/api/runs/:id/log', (req, res) => {
  const run = runs.find((r) => r.id === req.params.id)
  if (!run) return res.status(404).json({ error: 'not found' })
  const logFile = path.join(RUNS_DIR, run.folder, '.touchstone.log')
  res.type('text/plain; charset=utf-8')
  if (fs.existsSync(logFile)) res.send(fs.readFileSync(logFile, 'utf8'))
  else res.send('')
})

app.get('/api/runs/:id/files', (req, res) => {
  const run = runs.find((r) => r.id === req.params.id)
  if (!run) return res.status(404).json({ error: 'not found' })
  res.json({ files: listFiles(run.folder) })
})

app.post('/api/runs/:id/stop', (req, res) => {
  const run = runs.find((r) => r.id === req.params.id)
  if (!run) return res.status(404).json({ error: 'not found' })
  const proc = liveProcs.get(run.id)
  if (proc) {
    run.status = 'stopped'
    proc.kill('SIGTERM')
    setTimeout(() => proc.kill('SIGKILL'), 5000).unref()
  }
  saveRegistry()
  res.json({ ok: true })
})

app.delete('/api/runs/:id', (req, res) => {
  const idx = runs.findIndex((r) => r.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  const run = runs[idx]
  if (liveProcs.get(run.id)) {
    return res.status(400).json({ error: '请先停止运行中的任务' })
  }
  const dir = path.join(RUNS_DIR, run.folder)
  // 防御：只允许删除 runs 目录内的内容
  if (dir.startsWith(RUNS_DIR + path.sep) && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
    // 项目目录空了就一并清掉
    const parent = path.dirname(dir)
    if (parent !== RUNS_DIR && fs.existsSync(parent) && fs.readdirSync(parent).length === 0) {
      fs.rmdirSync(parent)
    }
  }
  runs.splice(idx, 1)
  delete stats.likes[run.id]
  saveStats()
  saveRegistry()
  broadcast({ type: 'removed', runId: run.id })
  res.json({ ok: true })
})

app.get('/robots.txt', (req, res) => {
  const origin = requestOrigin(req)
  res.type('text/plain; charset=utf-8').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /workspace/',
      'Disallow: /avatars/',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n')
  )
})

app.get('/sitemap.xml', (req, res) => {
  const origin = requestOrigin(req)
  const urls = [
    { loc: `${origin}/`, priority: '1.0', changefreq: 'daily', lastmod: latestIso(runs) },
    { loc: `${origin}/fable5`, priority: '0.9', changefreq: 'weekly', lastmod: latestIso(runs) },
  ]
  const projects = new Map()
  for (const run of runs) {
    const existing = projects.get(run.project)
    if (!existing || (run.createdAt || '') > (existing.createdAt || '')) projects.set(run.project, run)
  }
  for (const [project, run] of projects) {
    urls.push({
      loc: `${origin}/p/${encodeURIComponent(project)}`,
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: run.endedAt || run.createdAt,
    })
  }
  for (const [email, profile] of Object.entries(users)) {
    urls.push({
      loc: `${origin}/u/${encodeURIComponent(email)}`,
      priority: '0.5',
      changefreq: 'monthly',
      lastmod: profile.updatedAt || latestIso(runs.filter((r) => r.user === email)),
    })
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (u) =>
        `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${escapeXml(u.lastmod.slice(0, 10))}</lastmod>` : ''}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join('\n')}\n</urlset>\n`
  res.type('application/xml; charset=utf-8').send(body)
})

// 作品静态托管，供 iframe 预览与文件下载
app.use(
  '/workspace',
  express.static(RUNS_DIR, {
    index: 'index.html',
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-store')
    },
  })
)

// web/public 优先于 dist：fable5 数据/媒体由脚本直接写入 public，更新后无需重新构建
app.use(express.static(path.join(__dirname, 'web', 'public'), { index: false, maxAge: '5m' }))

// 生产模式：托管前端构建产物
const distDir = path.join(__dirname, 'web', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }))
  app.get(/^\/(?!api|ws|workspace|avatars).*/, (req, res) => {
    const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
    res.type('html').send(renderSeoHtml(indexHtml, seoForPath(req)))
  })
}

httpServer.listen(PORT, () => {
  console.log(`Touchstone server: http://localhost:${PORT}`)
  // 回填：旧 run 的分类与缩略图（截图需要服务已就绪）
  for (const r of runs) {
    if (!r.category) r.category = classifyHeuristic(r.prompt)
    if (r.status === 'done' && r.entry) {
      r.preview = fs.existsSync(previewPath(r))
      if (!r.preview) capturePreview(r)
    }
  }
  saveRegistry()
})
