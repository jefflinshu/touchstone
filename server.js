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

fs.mkdirSync(RUNS_DIR, { recursive: true })
fs.mkdirSync(DATA_DIR, { recursive: true })

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
let stats = { views: {}, likes: {} }
if (fs.existsSync(STATS_FILE)) {
  try {
    stats = { views: {}, likes: {}, ...JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) }
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
      const msg = `${run.project}: ${run.agentName}${model ? ` (${model})` : ''} 作品完成`
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
    if (run.status === 'done' && run.publish) autoCommitRun(run)
  })

  proc.on('error', (err) => {
    fs.appendFileSync(logFile, `\n[touchstone] 启动失败: ${err}\n`)
  })
}

// ---------- API ----------

app.use(express.json({ limit: '1mb' }))

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
  `为下面的编程任务起一个 2-4 个英文单词的 kebab-case 短名（如 bouncing-ball-hexagon），只输出名字本身，不要任何其他文字：\n${prompt.slice(0, 500)}`

const cleanName = (raw) =>
  slugify(
    (raw || '').trim().split('\n').filter(Boolean).pop()?.toLowerCase().replace(/[^a-z0-9 _-]/g, '').trim() || ''
  ).slice(0, 40)

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

async function nameViaApi(prompt) {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 64,
    messages: [{ role: 'user', content: NAMING_PROMPT(prompt) }],
  })
  return cleanName(msg.content.find((b) => b.type === 'text')?.text)
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
        done('')
      }, 25000)
      proc.on('close', () => {
        clearTimeout(timer)
        done(cleanName(out))
      })
      proc.on('error', () => done(''))
    } catch {
      done('')
    }
  })
}

async function autoNameProject(prompt) {
  let name = ''
  if (anthropic) {
    try {
      name = await nameViaApi(prompt)
    } catch (err) {
      console.error('[naming] API 失败，回退 CLI：', err?.message)
    }
  }
  if (name.length < 2) name = await nameViaCli(prompt)
  if (name.length < 2) {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    name = `task-${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  }
  return name
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

// ---------- Google 登录（复用本机 gcloud CLI 凭据，gemini CLI 作回退） ----------
let authCache = { at: 0, email: null }

function geminiAccount() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.gemini', 'google_accounts.json'), 'utf8'))
    return j.active || null
  } catch {
    return null
  }
}

function getGoogleAccount(force = false) {
  if (!force && Date.now() - authCache.at < 30000) return Promise.resolve(authCache.email)
  return new Promise((resolve) => {
    execFile(
      'gcloud',
      ['auth', 'list', '--filter=status:ACTIVE', '--format=json'],
      { timeout: 10000 },
      (err, stdout) => {
        let email = null
        if (!err) {
          try {
            email = JSON.parse(stdout)[0]?.account || null
          } catch {}
        }
        if (!email) email = geminiAccount()
        authCache = { at: Date.now(), email }
        resolve(email)
      }
    )
  })
}

app.get('/api/auth/me', async (req, res) => {
  const email = await getGoogleAccount()
  res.json({ loggedIn: !!email, email })
})

// 拉起 gcloud 的浏览器 OAuth 流程，等用户在浏览器里完成授权后返回
let loginProc = null
app.post('/api/auth/login', async (req, res) => {
  if (!checkInstalled('gcloud')) {
    return res.status(400).json({
      error: '未检测到 gcloud CLI。安装：brew install google-cloud-sdk；或在终端运行 gemini 完成 Google 登录',
    })
  }
  if (!loginProc) {
    loginProc = spawn('gcloud', ['auth', 'login', '--brief', '--quiet'], {
      stdio: 'ignore',
      env: process.env,
    })
    const clear = () => (loginProc = null)
    loginProc.on('close', clear)
    loginProc.on('error', clear)
  }
  const deadline = Date.now() + 180000
  while (loginProc && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500))
  }
  const email = await getGoogleAccount(true)
  res.json({ loggedIn: !!email, email })
})

app.post('/api/tasks', async (req, res) => {
  const { prompt, runners, publish } = req.body || {}
  let { project } = req.body || {}
  if (!prompt || !Array.isArray(runners) || runners.length === 0) {
    return res.status(400).json({ error: 'prompt 和至少一个 runner 必填' })
  }
  const user = await getGoogleAccount()
  if (!user) {
    return res.status(401).json({ error: '请先登录 Google 账号' })
  }
  const cfg = loadAgentsConfig()
  if (!project || !String(project).trim()) {
    project = await autoNameProject(prompt)
  }
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
  res.json({ runs: runs.map(publicRun), views: stats.views })
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

// 生产模式：托管前端构建产物
const distDir = path.join(__dirname, 'web', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^\/(?!api|ws|workspace).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

httpServer.listen(PORT, () => {
  console.log(`Touchstone server: http://localhost:${PORT}`)
})
