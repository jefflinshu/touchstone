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
import { createAgentEventParser } from './agent-events.js'
import {
  allocateRunFolder,
  artifactTypeForEntry,
  expectedArtifactType,
  findArtifact,
  normalizeDeliveryMode,
} from './artifacts.js'
import { probeAgentCapabilityAsync, validateAgentSelection } from './agent-capabilities.js'
import { canManageRun, canReadRun, isRunPublished, visibleRunsFor } from './run-access.js'
import {
  ProviderRegistry,
  listProviderPresets,
  modelDiscoveryUrls,
  parseDiscoveredModels,
  providerRequestHeaders,
  providerRuntimeEnv,
} from './provider-registry.js'
import { ModelCatalog } from './model-catalog.js'
import { edgeProxyAuthorized } from './edge-auth.js'
import { createCredentialEnvelope } from './credential-envelope.js'
import { describeRunner, resolveRunnerAccess } from './runner-access.js'
import {
  MAX_SELECTED_SKILLS,
  SLASH_SKILL_AGENTS,
  agentLoadsSkills,
  buildSelectedSkillsPrefix,
  discoverInstalledSkills,
  installBundledSkill,
  loadSkillCatalog,
  mergeSkillCatalog,
  normalizeDeliveryConstraint,
  selectedSkillIssues,
  skillInstallerArgs,
} from './skill-registry.js'

const APP_DIR = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = path.resolve(APP_DIR, '../..')
const WEB_DIR = process.env.TOUCHSTONE_WEB_DIR || path.join(WORKSPACE_ROOT, 'apps', 'web')
const WEB_PUBLIC_DIR = path.join(WEB_DIR, 'public')
const WEB_DIST_DIR = path.join(WEB_DIR, 'dist')
const RUNS_DIR = process.env.TOUCHSTONE_RUNS_DIR || path.join(WORKSPACE_ROOT, 'runs')
const DATA_DIR = process.env.TOUCHSTONE_DATA_DIR || path.join(WORKSPACE_ROOT, 'data')
const REGISTRY_FILE = path.join(DATA_DIR, 'runs.json')
const PROVIDERS_FILE = path.join(DATA_DIR, 'providers.json')
const AGENTS_FILE = process.env.TOUCHSTONE_AGENTS_FILE || path.join(WORKSPACE_ROOT, 'agents.json')
const SKILLS_CATALOG_FILE =
  process.env.TOUCHSTONE_SKILLS_CATALOG_FILE || path.join(WORKSPACE_ROOT, 'skills', 'catalog.json')
const PORT = process.env.PORT || 3000
const SITE_NAME = 'Touchstone'
const SITE_DESCRIPTION =
  'Touchstone 是一个多模型 AI coding 作品对比平台，用同一个 prompt 同时运行 Codex、Claude、Gemini 等 coding agent，并展示可交互作品、提示词、运行指标和社区案例。'
const DEFAULT_SOCIAL_IMAGE = '/brand/touchstone-og.svg'
const DEFAULT_COMMUNITY_PUBLISH_URL = 'https://touchstone.jefflin.ai/api/publish'
const COLLECTION_ROUTES = {
  '/fable5': {
    title: 'Claude Fable 5 Prompts & Showcases · Touchstone',
    heading: 'Claude Fable 5 prompts and showcases',
    description: '浏览 Claude Fable 5 社区真实案例、热门 prompt、网页、游戏、设计、动画等分类作品，并复制可复用提示词。',
    dataFolder: 'fable5-data',
  },
  '/gpt5-6': {
    title: 'GPT-5.6 Prompts & Showcases · Touchstone',
    heading: 'GPT-5.6 prompts and showcases',
    description: '浏览带原帖来源的 GPT-5.6 社区案例、编程实验、游戏、3D 场景、前端作品和可复用提示词。',
    dataFolder: 'gpt5-6-data',
  },
  '/figma-motion': {
    title: 'Figma Motion Showcases · Touchstone',
    heading: 'Figma Motion showcases and animation references',
    description: '浏览 Figma Motion 发布信息、时间线动画案例、Agent 生成 motion 示例和可复用的动效设计灵感。',
    dataFolder: 'figma-motion-data',
  },
  '/ios-apps': {
    title: 'Design and iOS References · Touchstone',
    heading: 'Design and iOS app references',
    description: '浏览从 X 上收集的设计与 iOS App 案例，保留原帖来源、App Store/TestFlight 信号、设计截图或视频封面，并生成简短总结。',
    dataFolder: 'ios-apps-data',
  },
  '/oss-radar': {
    title: 'GitHub Open Source Projects · Touchstone',
    heading: 'Emerging AI and developer tools on GitHub',
    description: '浏览已收录的 GitHub 开源项目，展示项目分类、GitHub 指标和可复用的 X 搜索关键词。',
    previewFile: 'oss-radar-seo.json',
  },
}
const CORE_NAV_LINKS = [
  ['/', 'AI Coding Arena'],
  ['/fable5', 'Claude Fable 5'],
  ['/gpt5-6', 'GPT-5.6'],
  ['/figma-motion', 'Figma Motion'],
  ['/ios-apps', 'Design & iOS'],
  ['/oss-radar', 'OSS Radar'],
]
const PUBLISH_LIMITS = {
  maxFiles: Number(process.env.PUBLISH_MAX_FILES || 500),
  maxTotalBytes: Number(process.env.PUBLISH_MAX_TOTAL_BYTES || 50 * 1024 * 1024),
  maxFileBytes: Number(process.env.PUBLISH_MAX_FILE_BYTES || 20 * 1024 * 1024),
  maxDepth: Number(process.env.PUBLISH_MAX_DEPTH || 8),
}
const RUN_CONTRACT = `# Touchstone Run Output Contract

- Build the final artifact in this current directory.
- Touchstone can render a self-contained HTML, SVG, or Markdown artifact. Follow the user delivery constraint below.
- Keep every required resource inside the requested single file unless the user explicitly chooses a static folder.
- Do not depend on external CDN scripts or private localhost services.
- Do not read, write, or include secrets, credentials, tokens, hidden files, or parent-directory files.
- Do not write outside this directory.
`

fs.mkdirSync(RUNS_DIR, { recursive: true })
fs.mkdirSync(DATA_DIR, { recursive: true })
const providerRegistry = new ProviderRegistry(PROVIDERS_FILE)
const modelCatalog = new ModelCatalog({ fetchJson: fetchProviderJson })
const credentialEnvelope = createCredentialEnvelope()

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

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

function requestOrigin(req) {
  const configuredBaseUrl = process.env.PUBLIC_BASE_URL || process.env.BASE_URL
  if (configuredBaseUrl) {
    try {
      return new URL(configuredBaseUrl).origin
    } catch {}
  }
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

function latestIsoValue(values) {
  return values.filter(Boolean).reduce((max, value) => (value > max ? value : max), '')
}

function readWebJson(...segments) {
  for (const root of [WEB_PUBLIC_DIR, WEB_DIST_DIR]) {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, ...segments), 'utf8'))
    } catch {}
  }
  return null
}

function collectionIndex(dataFolder) {
  return readWebJson(dataFolder, 'index.json') || {}
}

function collectionPreview(dataFolder, limit = 12) {
  const index = collectionIndex(dataFolder)
  const firstPage = index.pages?.[0]?.file || 'pages/000.json'
  const items = readWebJson(dataFolder, ...firstPage.split('/'))
  return Array.isArray(items) ? items.slice(0, limit) : []
}

function routeCollectionPreview(config, limit = 12) {
  if (config.dataFolder) return collectionPreview(config.dataFolder, limit)
  if (config.previewFile) {
    const preview = readWebJson(config.previewFile)
    return Array.isArray(preview?.items) ? preview.items.slice(0, limit) : []
  }
  return []
}

function routeCollectionUpdatedAt(config) {
  if (config.dataFolder) return collectionIndex(config.dataFolder).updatedAt || ''
  if (config.previewFile) return readWebJson(config.previewFile)?.updatedAt || serverModifiedIso()
  return serverModifiedIso()
}

function serverModifiedIso() {
  try {
    return fs.statSync(path.join(APP_DIR, 'server.js')).mtime.toISOString()
  } catch {
    return ''
  }
}

function renderCoreNav() {
  return `<nav aria-label="Touchstone sections"><ul>${CORE_NAV_LINKS.map(
    ([href, label]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`
  ).join('')}</ul></nav>`
}

function renderHomeSeoBody() {
  return `<main class="seo-shell">
    <h1>Touchstone AI Coding Arena</h1>
    <p>${escapeHtml(SITE_DESCRIPTION)}</p>
    <p>Compare real output from Codex, Claude and Gemini coding agents, then explore prompts, interactive cases, design references and emerging open-source tools.</p>
    ${renderCoreNav()}
    <section>
      <h2>Explore AI building references</h2>
      <p>Touchstone collects reproducible prompts, source-linked community showcases, motion design references, iOS product examples and GitHub projects for people building with AI.</p>
    </section>
  </main>`
}

function renderCollectionSeoBody(config, items) {
  const list = items.length
    ? `<section><h2>Latest source-linked examples</h2><ol>${items
        .map((item) => {
          const sourceUrl = safeHttpUrl(item.sourceUrl)
          const title = cleanText(item.title || item.originalText || 'Community showcase', 140)
          const summary = cleanText(Array.isArray(item.summary) ? item.summary[0] : item.summary || item.note, 220)
          const byline = [cleanText(item.author || item.handle, 80), cleanText(item.date, 20)].filter(Boolean).join(' · ')
          return `<li><article><h3>${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" rel="nofollow">${escapeHtml(title)}</a>` : escapeHtml(title)}</h3>${
            byline ? `<p>${escapeHtml(byline)}</p>` : ''
          }${summary ? `<p>${escapeHtml(summary)}</p>` : ''}</article></li>`
        })
        .join('')}</ol></section>`
    : `<section><h2>What you can explore</h2><p>Browse curated examples, original sources, practical notes and reusable discovery keywords in this collection.</p></section>`

  return `<main class="seo-shell">
    <h1>${escapeHtml(config.heading)}</h1>
    <p>${escapeHtml(config.description)}</p>
    ${renderCoreNav()}
    ${list}
  </main>`
}

function renderProjectSeoBody(project, projectRuns, description) {
  const agents = [...new Set(projectRuns.map((run) => run.agentName).filter(Boolean))]
  return `<main class="seo-shell">
    <h1>${escapeHtml(project)} · AI coding case</h1>
    <p>${escapeHtml(description)}</p>
    ${agents.length ? `<p>Compared agents: ${agents.map(escapeHtml).join(', ')}.</p>` : ''}
    ${renderCoreNav()}
  </main>`
}

function renderProfileSeoBody(name, description) {
  return `<main class="seo-shell">
    <h1>${escapeHtml(name)} · Touchstone profile</h1>
    <p>${escapeHtml(description)}</p>
    ${renderCoreNav()}
  </main>`
}

function seoForPath(req) {
  const origin = requestOrigin(req)
  let pathname = publicPath(req.path || '/')
  let title = SITE_NAME
  let description = SITE_DESCRIPTION
  let type = 'WebSite'
  let body = renderHomeSeoBody()
  let found = pathname === '/'
  let mainEntity

  const collection = COLLECTION_ROUTES[pathname]
  if (collection) {
    found = true
    title = collection.title
    description = collection.description
    type = 'CollectionPage'
    const items = routeCollectionPreview(collection)
    body = renderCollectionSeoBody(collection, items)
    if (items.length) {
      mainEntity = {
        '@type': 'ItemList',
        numberOfItems: items.length,
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: cleanText(item.title || item.originalText || 'Community showcase', 140),
          ...(safeHttpUrl(item.sourceUrl) ? { url: safeHttpUrl(item.sourceUrl) } : {}),
        })),
      }
    }
  } else {
    const projectMatch = pathname.match(/^\/p\/([^/]+)$/)
    const userMatch = pathname.match(/^\/u\/([^/]+)$/)
    if (projectMatch) {
      const project = safeDecodeURIComponent(projectMatch[1])
      const projectRuns = runs.filter((r) => r.project === project && isRunPublished(r))
      if (projectRuns.length) {
        found = true
        const latest = projectRuns[projectRuns.length - 1]
        title = `${project} · Touchstone Case`
        const prompt = latest?.prompt ? `Prompt: ${cleanText(latest.prompt, 120)}` : '查看这个 AI coding case 的多模型作品对比。'
        description = `${prompt}${latest?.prompt?.length > 120 ? '...' : ''} ${projectRuns.length} runs across ${
          new Set(projectRuns.map((r) => r.agentName)).size || 'multiple'
        } agents.`.trim()
        type = 'CreativeWork'
        body = renderProjectSeoBody(project, projectRuns, description)
      }
    } else if (userMatch) {
      const email = safeDecodeURIComponent(userMatch[1])
      const profile = users[email] || {}
      const userRuns = runs.filter((run) => run.user === email && isRunPublished(run))
      if (userRuns.length) {
        found = true
        const name = profile.name || email
        title = `${name} · Touchstone Profile`
        description = cleanText(profile.bio, 180) || `查看 ${name} 在 Touchstone 发布和参与的 AI coding cases。`
        type = 'ProfilePage'
        body = renderProfileSeoBody(name, description)
      }
    }
  }

  if (!found) {
    title = `Page not found · ${SITE_NAME}`
    description = 'The requested Touchstone page could not be found.'
    type = 'WebPage'
    body = `<main class="seo-shell"><h1>Page not found</h1><p>${escapeHtml(description)}</p>${renderCoreNav()}</main>`
  }

  const canonical = `${origin}${pathname}`
  const image = `${origin}${DEFAULT_SOCIAL_IMAGE}`
  return {
    title,
    description,
    canonical,
    image,
    type,
    body,
    found,
    robots: found ? 'index,follow,max-image-preview:large' : 'noindex,nofollow',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': type,
      name: title,
      description,
      url: canonical,
      image,
      inLanguage: 'zh-CN',
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: origin },
      ...(mainEntity ? { mainEntity } : {}),
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
  out = replaceMeta(out, { kind: 'name', value: 'robots' }, { name: 'robots', content: seo.robots })
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
  out = /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i.test(out)
    ? out.replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i, jsonLd)
    : out.replace('</head>', `    ${jsonLd}\n  </head>`)
  return out.replace(/<div\s+id=["']root["']\s*><\/div>/i, `<div id="root">${seo.body}</div>`)
}

// ---------- 配置与注册表 ----------

function loadAgentsConfig() {
  return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'))
}

function listLocalSkills() {
  return mergeSkillCatalog(
    loadSkillCatalog(SKILLS_CATALOG_FILE),
    discoverInstalledSkills()
  )
}

function publicSkill(skill) {
  const { locations, ...safe } = skill
  return safe
}

function providerMessagesUrl(baseUrl) {
  return baseUrl.endsWith('/v1') ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`
}

async function fetchProviderJson(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.PROVIDER_PROBE_TIMEOUT_MS || 15_000))
  timer.unref()
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const raw = await response.text()
    let data
    try {
      data = raw ? JSON.parse(raw) : {}
    } catch {
      data = { error: raw }
    }
    if (!response.ok) {
      const detail =
        data?.error?.message ||
        data?.error ||
        data?.message ||
        `${response.status} ${response.statusText}`
      throw new Error(String(detail).slice(0, 1000))
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}

function skillInstallEnabled(req) {
  if (process.env.TOUCHSTONE_ALLOW_SKILL_INSTALL === '1') return true
  if (process.env.NODE_ENV === 'production') return false
  const host = String(req.get('host') || '').split(':')[0].replace(/^\[|\]$/g, '')
  const remote = String(req.socket?.remoteAddress || '')
  const directLoopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1'
  return directLoopback && (host === 'localhost' || host === '127.0.0.1' || host === '::1')
}

function runSkillInstaller(args) {
  return new Promise((resolve, reject) => {
    execFile(
      'npx',
      args,
      {
        cwd: WORKSPACE_ROOT,
        timeout: Number(process.env.SKILL_INSTALL_TIMEOUT_MS || 120_000),
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, DO_NOT_TRACK: '1', DISABLE_TELEMETRY: '1' },
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(String(stderr || stdout || error.message).trim().slice(0, 1200)))
          return
        }
        resolve({ stdout: String(stdout || '').slice(-4000), stderr: String(stderr || '').slice(-1000) })
      }
    )
  })
}

const agentCapabilityCache = new Map()

async function getAgentCapability(agent, force = false) {
  const now = Date.now()
  const fingerprint = JSON.stringify({
    command: agent.command,
    versionArgs: agent.versionArgs,
    minimumVersion: agent.minimumVersion,
    models: agent.models,
    modelsCommand: agent.modelsCommand,
    modelsRequired: agent.modelsRequired,
    modelRequirements: agent.modelRequirements,
    auth: agent.auth,
  })
  const cached = agentCapabilityCache.get(agent.id)
  if (!force && cached?.fingerprint === fingerprint) {
    if (cached.expiresAt > now) return cached.value || cached.promise
    // 过期后先返回旧结果，后台再刷新。冷探测要几秒，不能让某个倒霉的请求
    // 替所有人付这个代价并撞上边缘代理超时。
    if (cached.value) {
      cached.expiresAt = now + 60_000
      probeAgentCapabilityAsync(agent)
        .then((fresh) => {
          const current = agentCapabilityCache.get(agent.id)
          if (current?.fingerprint === fingerprint) current.value = fresh
        })
        .catch(() => {})
      return cached.value
    }
  }
  const entry = {
    fingerprint,
    expiresAt: now + 60_000,
    promise: probeAgentCapabilityAsync(agent),
    value: null,
  }
  agentCapabilityCache.set(agent.id, entry)
  try {
    entry.value = await entry.promise
    return entry.value
  } catch (error) {
    agentCapabilityCache.delete(agent.id)
    throw error
  }
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
// 服务重启后，残留的 running 状态标记为 interrupted。
// 队列只存在内存里，重启后 queued 的任务同样不会自己恢复。
for (const r of runs) {
  if (r.status === 'running' || r.status === 'pending' || r.status === 'queued') {
    r.status = 'interrupted'
    r.endedAt = r.endedAt || new Date().toISOString()
    delete r.queuePosition
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

app.use((req, res, next) => {
  if (!edgeProxyAuthorized(req)) {
    return res.status(403).json({ error: 'Touchstone edge authentication required' })
  }
  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim()
  const proto = forwardedProto || req.protocol
  const host = req.get('host') || ''
  const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)
  const shouldForceHttps = process.env.FORCE_HTTPS !== 'false' && !isLocalHost && proto === 'http'

  if (shouldForceHttps) {
    return res.redirect(308, `https://${host}${req.originalUrl}`)
  }
  if (proto === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000')
  }
  next()
})

function broadcast(msg, visibilityRun = null) {
  const run = visibilityRun || msg.run || (msg.runId ? runs.find((item) => item.id === msg.runId) : null)
  const data = JSON.stringify(msg)
  for (const client of wss.clients) {
    if (run && !isRunPublished(run) && client.touchstoneEmail !== run.user) continue
    if (
      msg.type === 'user' &&
      client.touchstoneEmail !== msg.email &&
      !runs.some((item) => item.user === msg.email && isRunPublished(item))
    ) {
      continue
    }
    if (
      msg.project &&
      !runs.some(
        (item) =>
          item.project === msg.project &&
          (isRunPublished(item) || (client.touchstoneEmail && item.user === client.touchstoneEmail))
      )
    ) {
      continue
    }
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

function findRunArtifact(folder, preferredType = null) {
  return findArtifact(path.join(RUNS_DIR, folder), preferredType)
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
  const { proc, publishAuth, ...rest } = r
  return { ...rest, likes: stats.likes[r.id] || 0 }
}

function writeRunContract(dir, run) {
  try {
    const selectedSkills = Array.isArray(run.selectedSkills) && run.selectedSkills.length
      ? `\n## Selected Skills\n\n${run.selectedSkills.map((skill) => `- ${skill}`).join('\n')}\n`
      : ''
    const delivery = run.deliveryConstraint
      ? `\n## User Delivery Constraint\n\n${run.deliveryConstraint}\n`
      : ''
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), `${RUN_CONTRACT}${selectedSkills}${delivery}`)
  } catch {}
}

function safeRelativePath(value) {
  const raw = String(value || '')
  if (raw.startsWith('/') || raw.includes('\\')) return null
  const rel = raw.replace(/^\/+/, '')
  const parts = rel.split('/').filter(Boolean)
  if (!parts.length || parts.length > PUBLISH_LIMITS.maxDepth) return null
  if (parts.some((part) => part === '.' || part === '..' || part.includes('\0'))) return null
  return parts.join('/')
}

function isBlockedPublishPath(rel) {
  const parts = rel.split('/')
  const lower = parts.map((part) => part.toLowerCase())
  if (lower.some((part) => part.startsWith('.') || part === 'node_modules')) return true
  if (lower.includes('node_modules') || lower.includes('.git') || lower.includes('.ssh')) return true
  const base = lower[lower.length - 1]
  if (
    [
      'agents.md',
      '.touchstone.log',
      '.touchstone-preview.png',
      '.env',
      '.env.local',
      '.env.production',
      'id_rsa',
      'id_ed25519',
    ].includes(base)
  ) {
    return true
  }
  return /\.(pem|key|crt|p12|pfx|sqlite|db|log|command|sh|bash|zsh|fish|ps1|bat|cmd|exe|dll|dylib|so)$/i.test(base)
}

function collectPublishFiles(folder) {
  const root = path.join(RUNS_DIR, folder)
  const files = []
  let totalBytes = 0

  function walk(rel, depth) {
    if (depth > PUBLISH_LIMITS.maxDepth) return
    const dir = path.join(root, rel)
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name
      const safeRel = safeRelativePath(childRel)
      if (!safeRel || isBlockedPublishPath(safeRel)) continue
      const abs = path.join(root, safeRel)
      let stat
      try {
        stat = fs.lstatSync(abs)
      } catch {
        continue
      }
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) {
        walk(safeRel, depth + 1)
        continue
      }
      if (!stat.isFile()) continue
      if (stat.size > PUBLISH_LIMITS.maxFileBytes) {
        throw new Error(`文件过大：${safeRel}`)
      }
      totalBytes += stat.size
      if (totalBytes > PUBLISH_LIMITS.maxTotalBytes) throw new Error('发布文件总大小超过限制')
      if (files.length >= PUBLISH_LIMITS.maxFiles) throw new Error('发布文件数量超过限制')
      files.push({ path: safeRel, size: stat.size, contentBase64: fs.readFileSync(abs).toString('base64') })
    }
  }

  walk('', 0)
  if (!files.some((file) => artifactTypeForEntry(file.path))) {
    throw new Error('发布作品必须包含 HTML、SVG 或 Markdown 入口')
  }
  return { files, totalBytes }
}

function communityPublishUrl() {
  const override = process.env.COMMUNITY_PUBLISH_URL
  if (override === 'off' || override === 'false' || override === '') return null
  if (override) return override
  try {
    const publicHost = new URL(process.env.PUBLIC_BASE_URL || process.env.BASE_URL || '').hostname
    if (publicHost === 'touchstone.jefflin.ai') return null
  } catch {}
  return DEFAULT_COMMUNITY_PUBLISH_URL
}

function publishToken() {
  return process.env.COMMUNITY_PUBLISH_TOKEN || process.env.PUBLISH_API_TOKEN || ''
}

async function publishCompletedRun(run) {
  const target = communityPublishUrl()
  if (!target) {
    run.publishState = 'published'
    run.publishedAt = new Date().toISOString()
    saveRegistry()
    broadcast({ type: 'run', run: publicRun(run) })
    autoCommitRun(run)
    return
  }

  try {
    const { files, totalBytes } = collectPublishFiles(run.folder)
    const body = {
      schema: 1,
      source: 'touchstone-local',
      idToken: publishCredentials.get(run.id)?.idToken || null,
      run: {
        id: run.id,
        batchId: run.batchId,
        agentId: run.agentId,
        agentName: run.agentName,
        model: run.model,
        resolvedModel: run.resolvedModel,
        color: run.color,
        project: run.project,
        prompt: run.prompt,
        category: run.category,
        metrics: run.metrics,
        artifactType: run.artifactType,
        expectedArtifactType: run.expectedArtifactType,
        deliveryMode: run.deliveryMode,
        deliveryConstraint: run.deliveryConstraint,
        interaction: run.interaction,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        exitCode: run.exitCode,
      },
      files,
    }
    const headers = { 'Content-Type': 'application/json' }
    const token = publishToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetch(target, { method: 'POST', headers, body: JSON.stringify(body) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || `发布失败：${response.status}`)
    run.publishState = 'published'
    run.publishedAt = result.run?.publishedAt || new Date().toISOString()
    run.publicUrl = result.url || null
    run.publishedBytes = totalBytes
    saveRegistry()
    broadcast({ type: 'run', run: publicRun(run) })
  } catch (err) {
    run.publishState = 'failed'
    run.publishError = String(err?.message || err).slice(0, 300)
    saveRegistry()
    broadcast({ type: 'run', run: publicRun(run) })
    console.error('[publish] 发布失败：', run.publishError)
  } finally {
    publishCredentials.delete(run.id)
  }
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
  if (!chromeBin || !run.entry || run.artifactType === 'markdown') return
  shotQueue = shotQueue
    .then(
      () =>
        new Promise((resolve) => {
          const out = previewPath(run)
          const folderPath = run.folder.split('/').map(encodeURIComponent).join('/')
          const url = `http://localhost:${PORT}/workspace/${folderPath}/${run.entry}?__capture=${WORKSPACE_CAPTURE_TOKEN}`
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
    execFile('git', args, { cwd: WORKSPACE_ROOT }, (error, stdout, stderr) => resolve({ error, stdout, stderr }))
  )

let gitQueue = Promise.resolve()

function autoCommitRun(run) {
  if (process.env.DISABLE_GIT_AUTOCOMMIT === '1') return
  const gitCfg = loadAgentsConfig().defaults.git || {}
  if (gitCfg.autoCommit === false) return
  gitQueue = gitQueue
    .then(async () => {
      if (!fs.existsSync(path.join(WORKSPACE_ROOT, '.git'))) return
      await execGit(['add', '--', path.join('runs', run.folder), path.join('data', 'runs.json')])
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

const liveProcs = new Map() // runId -> { proc, agent, emitEvent }
const publishCredentials = new Map() // runId -> { idToken }

// ---------- 并发闸门 ----------
// 每个 run 都是一个独立 CLI 进程，可能吃掉数 GB 内存并大量读写磁盘。
// 超过上限的 run 停在 queued 状态，等前面的进程退出后按入队顺序接上。
const runQueue = [] // { run, agent, prompt, timeoutMinutes, runtimeEnv }

function maxConcurrentRuns() {
  const configured = Number(loadAgentsConfig().defaults?.maxConcurrentRuns)
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 4
}

function enqueueRun(entry) {
  if (liveProcs.size < maxConcurrentRuns()) {
    startRun(entry.run, entry.agent, entry.prompt, entry.timeoutMinutes, entry.runtimeEnv)
    return
  }
  runQueue.push(entry)
  entry.run.status = 'queued'
  entry.run.queuePosition = runQueue.length
  broadcast({ type: 'run', run: publicRun(entry.run) })
}

function drainRunQueue() {
  while (runQueue.length && liveProcs.size < maxConcurrentRuns()) {
    const entry = runQueue.shift()
    // 排队期间被停止或删除的 run 不再启动。
    if (entry.run.status !== 'queued') continue
    delete entry.run.queuePosition
    startRun(entry.run, entry.agent, entry.prompt, entry.timeoutMinutes, entry.runtimeEnv)
  }
  runQueue.forEach((entry, index) => {
    entry.run.queuePosition = index + 1
    broadcast({ type: 'run', run: publicRun(entry.run) })
  })
  saveRegistry()
}

function dropFromRunQueue(runId) {
  const index = runQueue.findIndex((entry) => entry.run.id === runId)
  if (index === -1) return false
  runQueue.splice(index, 1)
  return true
}

function startRun(run, agent, prompt, timeoutMinutes, runtimeEnv = {}) {
  const dir = path.join(RUNS_DIR, run.folder)
  fs.mkdirSync(dir, { recursive: true })
  writeRunContract(dir, run)
  const logFile = path.join(dir, '.touchstone.log')
  const eventsFile = path.join(dir, '.touchstone-events.jsonl')

  const args = agent.args.map((a) => a.replaceAll('{{PROMPT}}', prompt))
  if (run.model && agent.modelFlag) args.push(agent.modelFlag, run.model)
  const startNote = `$ ${agent.command} ${args.map((a) => (a.length > 200 ? a.slice(0, 200) + '…' : a)).join(' ')}\n\n`
  fs.writeFileSync(logFile, startNote)
  fs.writeFileSync(eventsFile, '')

  const emitEvent = (event) => {
    fs.appendFileSync(eventsFile, `${JSON.stringify(event)}\n`)
    broadcast({ type: 'agent_event', runId: run.id, event })
  }
  let proc
  const eventParser = createAgentEventParser({
    agentId: agent.id,
    emit: emitEvent,
    onResult: () => {
      if (agent.inputFormat === 'claude-stream-json' && proc?.stdin?.writable) proc.stdin.end()
    },
  })
  eventParser.status('running', 'Starting agent')

  run.status = 'running'
  run.startedAt = new Date().toISOString()
  saveRegistry()
  broadcast({ type: 'run', run: publicRun(run) })

  try {
    proc = spawn(agent.command, args, {
      cwd: dir,
      env: { ...process.env, ...runtimeEnv, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (err) {
    run.status = 'failed'
    run.endedAt = new Date().toISOString()
    run.error = String(err)
    saveRegistry()
    broadcast({ type: 'run', run: publicRun(run) })
    // 启动失败也要让出名额，否则队列会永久卡住。
    drainRunQueue()
    return
  }

  liveProcs.set(run.id, { proc, agent, emitEvent })
  if (agent.inputFormat === 'claude-stream-json') {
    proc.stdin.write(
      `${JSON.stringify({
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text: prompt }] },
      })}\n`
    )
  }

  const onChunk = (channel) => (buf) => {
    const text = buf.toString('utf8')
    fs.appendFileSync(logFile, text)
    broadcast({ type: 'log', runId: run.id, chunk: text })
    eventParser.push(channel, text)
    // 运行过程中可能已经产出了作品，顺手刷新入口和实际类型。
    const artifact = findRunArtifact(run.folder, run.expectedArtifactType)
    if (artifact?.entry !== run.entry || artifact?.type !== run.artifactType) {
      run.entry = artifact?.entry || null
      run.artifactType = artifact?.type || null
      saveRegistry()
      broadcast({ type: 'run', run: publicRun(run) })
    }
  }
  proc.stdout.on('data', onChunk('stdout'))
  proc.stderr.on('data', onChunk('stderr'))

  const timeout = setTimeout(() => {
    fs.appendFileSync(logFile, `\n[touchstone] 超过 ${timeoutMinutes} 分钟超时，已终止\n`)
    proc.kill('SIGKILL')
    run.timedOut = true
  }, timeoutMinutes * 60 * 1000)

  proc.on('close', (code) => {
    clearTimeout(timeout)
    eventParser.end()
    liveProcs.delete(run.id)
    run.exitCode = code
    run.endedAt = new Date().toISOString()
    const artifact = findRunArtifact(run.folder, run.expectedArtifactType)
    run.entry = artifact?.entry || null
    run.artifactType = artifact?.type || null
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
    eventParser.status(run.status === 'done' ? 'completed' : 'failed', run.status === 'done' ? 'Run completed' : run.error || 'Run stopped')
    fs.appendFileSync(logFile, `\n[touchstone] 进程退出，exit code = ${code}\n`)
    saveRegistry()
    broadcast({ type: 'run', run: publicRun(run) })
    if (run.status === 'done') {
      capturePreview(run)
      if (run.publish) publishCompletedRun(run)
    }
    drainRunQueue()
  })

  proc.on('error', (err) => {
    fs.appendFileSync(logFile, `\n[touchstone] 启动失败: ${err}\n`)
  })
}

// ---------- API ----------

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '80mb' }))

function runnerAccess(req) {
  return resolveRunnerAccess(
    currentSession(req)?.email,
    process.env.TOUCHSTONE_RUNNER_OWNER_EMAILS
  )
}

function runnerDescriptor(req) {
  return describeRunner({
    email: currentSession(req)?.email,
    ownerList: process.env.TOUCHSTONE_RUNNER_OWNER_EMAILS,
    label: process.env.TOUCHSTONE_RUNNER_LABEL || 'Owner Mac',
  })
}

function requireRunnerOwner(req, res) {
  const access = runnerAccess(req)
  if (!access.email) {
    res.status(401).json({ error: '请先登录后使用本地执行器', code: 'RUNNER_LOGIN_REQUIRED' })
    return null
  }
  if (!access.canExecute) {
    res.status(403).json({
      error: '这台本地执行器仅允许设备所有者使用；当前账号尚未配对个人 Companion。',
      code: 'RUNNER_NOT_PAIRED',
    })
    return null
  }
  return access
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'touchstone',
    baseUrl: oauthBaseUrl(req),
    googleOAuthConfigured: googleOAuthReady(),
    uptime: Math.round(process.uptime()),
  })
})

app.get('/api/agents', async (req, res) => {
  // 本地 CLI 的存在与健康状态是只读信息，未登录也返回，让页面能区分
  // “没装 CLI” 和 “没登录”；能否真正下发任务由 runner.canExecute 决定。
  const runner = runnerDescriptor(req)
  const cfg = loadAgentsConfig()
  res.json({
    agents: await Promise.all(cfg.agents.map(async (a) => {
      const capability = await getAgentCapability(a, req.query.refresh === '1')
      const modelHealth = { ...capability.health.modelHealth }
      const models = [...new Set([...probeLocalModels(a.id), ...capability.discoveredModels, ...(a.models || [])])]
      for (const model of models) {
        modelHealth[model] ||= {
          available: capability.health.ready,
          minimumVersion: null,
          fix: capability.health.ready ? null : capability.health.fix,
        }
      }
      models.sort((left, right) => Number(modelHealth[right]?.available) - Number(modelHealth[left]?.available))
      return {
        id: a.id,
        name: a.name,
        color: a.color,
        install: a.install || null,
        preferredProtocol: a.preferredProtocol || null,
        interaction: a.interaction || { input: false, questions: false, progress: true, mode: 'one-shot' },
        // 只有支持 slash 展开的 Agent 才能确定性加载 Skill。
        slashSkills: SLASH_SKILL_AGENTS.has(a.id),
        models,
        health: { ...capability.health, modelHealth },
      }
    })),
    defaults: { ...cfg.defaults, maxSelectedSkills: MAX_SELECTED_SKILLS },
    runner,
  })
})

app.get('/api/providers', (req, res) => {
  const access = requireRunnerOwner(req, res)
  if (!access) return
  res.json({ providers: providerRegistry.list(access.email) })
})

app.get('/api/provider-presets', (_req, res) => {
  res.json({ presets: listProviderPresets() })
})

app.get('/api/providers/encryption-key', (req, res) => {
  if (!requireRunnerOwner(req, res)) return
  res.setHeader('Cache-Control', 'no-store')
  res.json(credentialEnvelope.publicDescriptor())
})

app.get('/api/model-catalog', async (req, res) => {
  const providerId = String(req.query.provider || '').trim()
  if (!/^[a-z0-9_-]{1,80}$/i.test(providerId)) {
    return res.status(400).json({ error: 'Provider catalog ID 无效' })
  }
  try {
    const catalog = await modelCatalog.provider(providerId)
    if (!catalog) return res.status(404).json({ error: 'models.dev 中没有这个 Provider' })
    res.json({ catalog })
  } catch (error) {
    res.status(502).json({
      error: `models.dev 模型目录暂时不可用：${error.name === 'AbortError' ? '请求超时' : error.message}`,
    })
  }
})

app.post('/api/providers', (req, res) => {
  const access = requireRunnerOwner(req, res)
  if (!access) return
  try {
    const input = { ...(req.body || {}) }
    if (input.credentialEnvelope) {
      input.credential = credentialEnvelope.decrypt(input.credentialEnvelope)
      delete input.credentialEnvelope
    } else if (input.credential && process.env.TOUCHSTONE_REQUIRE_ENCRYPTED_CREDENTIALS === '1') {
      return res.status(400).json({ error: 'API Token 必须先在浏览器中加密', code: 'CREDENTIAL_ENCRYPTION_REQUIRED' })
    }
    const provider = providerRegistry.upsert(access.email, input)
    res.json({ provider, providers: providerRegistry.list(access.email) })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/providers/:id', (req, res) => {
  const access = requireRunnerOwner(req, res)
  if (!access) return
  const removed = providerRegistry.remove(access.email, req.params.id)
  if (!removed) return res.status(404).json({ error: 'Provider 不存在' })
  res.json({ ok: true, providers: providerRegistry.list(access.email) })
})

app.post('/api/providers/:id/discover', async (req, res) => {
  const access = requireRunnerOwner(req, res)
  if (!access) return
  const provider = providerRegistry.resolve(access.email, req.params.id)
  if (!provider) return res.status(404).json({ error: 'Provider 不存在' })
  const errors = []
  for (const url of modelDiscoveryUrls(provider.baseUrl)) {
    try {
      const data = await fetchProviderJson(url, {
        headers: providerRequestHeaders(provider),
      })
      const models = parseDiscoveredModels(data)
      if (!models.length) throw new Error('接口没有返回模型 ID')
      const updated = providerRegistry.replaceModels(access.email, provider.id, models)
      return res.json({ provider: updated, providers: providerRegistry.list(access.email) })
    } catch (error) {
      errors.push(`${url}: ${error.name === 'AbortError' ? '请求超时' : error.message}`)
    }
  }
  res.status(502).json({ error: `模型同步失败：${errors.join('；')}` })
})

app.post('/api/providers/:id/test', async (req, res) => {
  const access = requireRunnerOwner(req, res)
  if (!access) return
  const provider = providerRegistry.resolve(access.email, req.params.id)
  if (!provider) return res.status(404).json({ error: 'Provider 不存在' })
  const model = String(req.body?.model || provider.models?.[0] || '').trim()
  if (!model) return res.status(400).json({ error: '请先填写至少一个模型 ID' })
  try {
    const data = await fetchProviderJson(providerMessagesUrl(provider.baseUrl), {
      method: 'POST',
      headers: providerRequestHeaders(provider),
      body: JSON.stringify({
        model,
        max_tokens: 64,
        messages: [{ role: 'user', content: 'Call the touchstone_probe tool with value "ok".' }],
        tools: [
          {
            name: 'touchstone_probe',
            description: 'A no-op compatibility probe.',
            input_schema: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'touchstone_probe' },
      }),
    })
    const toolUse = Array.isArray(data.content)
      ? data.content.find((item) => item?.type === 'tool_use' && item?.name === 'touchstone_probe')
      : null
    if (!toolUse) {
      return res.status(409).json({
        error: 'Provider 请求成功，但模型没有返回 Anthropic tool_use；不建议用于 Claude Code。',
        model: data.model || model,
      })
    }
    res.json({
      ok: true,
      model: data.model || model,
      toolUse: true,
      message: 'Anthropic Messages 与 tool_use 预检通过',
    })
  } catch (error) {
    res.status(502).json({
      error: `Provider 预检失败：${error.name === 'AbortError' ? '请求超时' : error.message}`,
    })
  }
})

app.get('/api/skills', (req, res) => {
  // 同 /api/agents：本机已装 Skill 是只读信息，未登录也可浏览。
  const runner = runnerDescriptor(req)
  try {
    res.json({
      skills: listLocalSkills().map(publicSkill),
      installEnabled: runner.canExecute && skillInstallEnabled(req),
      supportedAgents: loadAgentsConfig().agents.map((agent) => agent.id),
      runner,
    })
  } catch (error) {
    res.status(500).json({ error: `读取 Skills 失败：${error.message}` })
  }
})

app.post('/api/skills/install', async (req, res) => {
  if (!requireRunnerOwner(req, res)) return
  if (!skillInstallEnabled(req)) {
    return res.status(403).json({
      error: '此页面连接的不是允许写入的本地 Touchstone。请在本机打开，或为可信本地服务设置 TOUCHSTONE_ALLOW_SKILL_INSTALL=1。',
    })
  }
  const id = String(req.body?.id || '').trim()
  const configuredAgents = new Set(loadAgentsConfig().agents.map((agent) => agent.id))
  const agentIds = [...new Set(Array.isArray(req.body?.agentIds) ? req.body.agentIds : [])]
    .map((agentId) => String(agentId || '').trim())
    .filter((agentId) => configuredAgents.has(agentId))
  const catalog = loadSkillCatalog(SKILLS_CATALOG_FILE)
  const entry = catalog.find((skill) => skill.id === id)
  if (!entry) return res.status(404).json({ error: '该 Skill 不在 Touchstone 安装白名单中' })
  if (!agentIds.length) return res.status(400).json({ error: '至少选择一个目标 Agent' })

  try {
    let output = null
    if (entry.sourceType === 'bundled') {
      output = { installed: installBundledSkill(entry, agentIds, { workspaceRoot: WORKSPACE_ROOT }) }
    } else {
      const args = skillInstallerArgs(entry, agentIds)
      if (!args) throw new Error('Unsupported Skill installer')
      output = await runSkillInstaller(args)
    }
    res.json({
      ok: true,
      output,
      skills: listLocalSkills().map(publicSkill),
    })
  } catch (error) {
    res.status(500).json({ error: `安装 Skill 失败：${error.message}` })
  }
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
const FABLE5_TRANSLATION_LANGUAGES = new Set(['en', 'zh', 'ja', 'es', 'ko', 'fr', 'de'])
const FABLE5_TRANSLATION_MODEL = 'claude-haiku-4-5'
const FABLE5_TRANSLATION_BATCH_LIMIT = 20

function normalizeFable5TranslationLanguage(value) {
  const code = String(value || '').toLowerCase().split('-')[0]
  return FABLE5_TRANSLATION_LANGUAGES.has(code) ? code : 'en'
}

function cleanFable5TranslationField(value, max = 320) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function fable5TranslationSourceHash(item) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify([cleanFable5TranslationField(item.title), cleanFable5TranslationField(item.summary)]))
    .digest('hex')
}

function getCachedFable5Translation(language, item) {
  const entry = fable5Translations?.[language]?.[item.id]
  if (!entry) return null
  if (entry.sourceHash !== fable5TranslationSourceHash(item)) return null
  const cached = {
    title: cleanFable5TranslationField(entry.title) || cleanFable5TranslationField(item.title),
    summary: cleanFable5TranslationField(entry.summary) || cleanFable5TranslationField(item.summary),
  }
  if (
    language !== 'en' &&
    cached.title === cleanFable5TranslationField(item.title) &&
    cached.summary === cleanFable5TranslationField(item.summary)
  ) {
    return null
  }
  return cached
}

function setCachedFable5Translation(language, item, translation) {
  const next = {
    sourceHash: fable5TranslationSourceHash(item),
    title: cleanFable5TranslationField(translation.title) || cleanFable5TranslationField(item.title),
    summary: cleanFable5TranslationField(translation.summary) || cleanFable5TranslationField(item.summary),
    updatedAt: new Date().toISOString(),
  }
  if (!fable5Translations[language]) fable5Translations[language] = {}
  fable5Translations[language][item.id] = next
  return next
}

function parseFable5Translations(raw, items) {
  const fallback = Object.fromEntries(
    items.map((item) => [
      item.id,
      { title: cleanFable5TranslationField(item.title), summary: cleanFable5TranslationField(item.summary) },
    ])
  )
  try {
    const match = String(raw || '').match(/\[[\s\S]*\]/)
    if (!match) return fallback
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return fallback
    for (const entry of parsed) {
      const id = String(entry?.id || '').trim()
      if (!fallback[id]) continue
      fallback[id] = {
        title: cleanFable5TranslationField(entry.title) || fallback[id].title,
        summary: cleanFable5TranslationField(entry.summary) || fallback[id].summary,
      }
    }
  } catch {}
  return fallback
}

function buildFable5TranslationPrompt(language, items) {
  return [
    `Translate each showcase card into ${language}.`,
    'Keep product names, handles, model names, and technical acronyms unchanged when appropriate.',
    'Return only one JSON array. No markdown.',
    'Each item must be {"id":"...","title":"...","summary":"..."}.',
    'If the source is already natural in the target language, keep it.',
    'Keep title concise and summary to one short sentence.',
    '',
    JSON.stringify(
      items.map((item) => ({
        id: item.id,
        title: cleanFable5TranslationField(item.title),
        summary: cleanFable5TranslationField(item.summary),
      }))
    ),
  ].join('\n')
}

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

async function translateFable5BatchViaApi(language, items) {
  const msg = await anthropic.messages.create({
    model: FABLE5_TRANSLATION_MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: buildFable5TranslationPrompt(language, items) }],
  })
  return parseFable5Translations(msg.content.find((block) => block.type === 'text')?.text, items)
}

function translateFable5BatchViaCli(language, items) {
  return new Promise((resolve) => {
    let settled = false
    const done = (value) => {
      if (!settled) {
        settled = true
        resolve(value)
      }
    }
    try {
      const proc = spawn('claude', ['-p', buildFable5TranslationPrompt(language, items), '--model', 'haiku'], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      let out = ''
      proc.stdout.on('data', (chunk) => (out += chunk))
      const timer = setTimeout(() => {
        proc.kill('SIGKILL')
        done(parseFable5Translations('', items))
      }, 45000)
      proc.on('close', () => {
        clearTimeout(timer)
        done(parseFable5Translations(out, items))
      })
      proc.on('error', () => done(parseFable5Translations('', items)))
    } catch {
      done(parseFable5Translations('', items))
    }
  })
}

function translateFable5BatchViaCodexCli(language, items) {
  return new Promise((resolve) => {
    let settled = false
    const done = (value) => {
      if (!settled) {
        settled = true
        resolve(value)
      }
    }
    try {
      const proc = spawn('codex', ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', buildFable5TranslationPrompt(language, items)], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      let out = ''
      proc.stdout.on('data', (chunk) => (out += chunk))
      const timer = setTimeout(() => {
        proc.kill('SIGKILL')
        done(parseFable5Translations('', items))
      }, 45000)
      proc.on('close', () => {
        clearTimeout(timer)
        done(parseFable5Translations(out, items))
      })
      proc.on('error', () => done(parseFable5Translations('', items)))
    } catch {
      done(parseFable5Translations('', items))
    }
  })
}

function fable5TranslationsChangedSource(translations, items) {
  return items.some((item) => {
    const next = translations[item.id]
    if (!next) return false
    return next.title !== cleanFable5TranslationField(item.title) || next.summary !== cleanFable5TranslationField(item.summary)
  })
}

async function translateFable5Batch(language, items) {
  if (!items.length) return {}
  if (anthropic) {
    try {
      const translated = await translateFable5BatchViaApi(language, items)
      if (fable5TranslationsChangedSource(translated, items)) return translated
    } catch (err) {
      console.error('[fable5 translation] API 失败，回退 CLI：', err?.message)
    }
  }
  const claudeCli = await translateFable5BatchViaCli(language, items)
  if (fable5TranslationsChangedSource(claudeCli, items)) return claudeCli
  return translateFable5BatchViaCodexCli(language, items)
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

// ---------- Community publish ----------

function acceptedGoogleClientIds() {
  return [
    process.env.GOOGLE_CLIENT_ID,
    ...(process.env.PUBLISH_GOOGLE_CLIENT_IDS || '').split(','),
  ]
    .map((id) => String(id || '').trim())
    .filter(Boolean)
}

async function verifyGoogleIdToken(idToken) {
  if (!idToken) return null
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error_description || data.error || `Google token 验证失败：${response.status}`)
  const allowedAudiences = acceptedGoogleClientIds()
  if (allowedAudiences.length && !allowedAudiences.includes(data.aud)) throw new Error('Google token audience 不匹配')
  if (String(data.email_verified) !== 'true') throw new Error('Google 邮箱未验证')
  if (!data.email) throw new Error('Google token 缺少 email')
  return {
    email: data.email,
    name: data.name || data.email.split('@')[0],
    picture: data.picture || null,
  }
}

async function publishIdentity(req, body) {
  const cur = currentSession(req)
  if (cur?.email) return { email: cur.email, name: cur.name, picture: cur.picture, method: 'session' }

  const auth = String(req.get('authorization') || '')
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (bearer && process.env.PUBLISH_API_TOKEN && bearer === process.env.PUBLISH_API_TOKEN) {
    const email = String(body?.user?.email || body?.run?.user || 'publisher@touchstone.local').trim()
    return { email, name: body?.user?.name || email.split('@')[0], picture: body?.user?.picture || null, method: 'token' }
  }

  const google = await verifyGoogleIdToken(body?.idToken)
  if (google) return { ...google, method: 'google' }
  return null
}

function validatePublishFiles(files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error('files required')
  if (files.length > PUBLISH_LIMITS.maxFiles) throw new Error('文件数量超过限制')

  const seen = new Set()
  let totalBytes = 0
  const out = []
  for (const file of files) {
    const rel = safeRelativePath(file?.path)
    if (!rel || isBlockedPublishPath(rel)) throw new Error(`非法文件路径：${file?.path || ''}`)
    if (seen.has(rel)) throw new Error(`重复文件：${rel}`)
    seen.add(rel)
    if (typeof file.contentBase64 !== 'string' || !file.contentBase64) throw new Error(`文件内容为空：${rel}`)
    const bytes = Buffer.from(file.contentBase64, 'base64')
    if (bytes.length === 0) throw new Error(`文件内容为空：${rel}`)
    if (bytes.length > PUBLISH_LIMITS.maxFileBytes) throw new Error(`文件过大：${rel}`)
    totalBytes += bytes.length
    if (totalBytes > PUBLISH_LIMITS.maxTotalBytes) throw new Error('发布文件总大小超过限制')
    out.push({ path: rel, bytes })
  }
  if (!out.some((file) => artifactTypeForEntry(file.path))) {
    throw new Error('发布作品必须包含 HTML、SVG 或 Markdown 入口')
  }
  return { files: out, totalBytes }
}

function uniquePublishedFolder(project, base) {
  const projectSlug = slugify(project)
  const baseSlug = slugify(base)
  let sub = baseSlug
  for (let n = 2; fs.existsSync(path.join(RUNS_DIR, projectSlug, sub)); n++) sub = `${baseSlug}_${n}`
  return `${projectSlug}/${sub}`
}

function writePublishedFiles(folder, files) {
  const root = path.join(RUNS_DIR, folder)
  fs.mkdirSync(root, { recursive: true })
  for (const file of files) {
    const abs = path.join(root, file.path)
    if (!abs.startsWith(root + path.sep)) throw new Error(`非法文件路径：${file.path}`)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, file.bytes)
  }
}

function registerPublishedRun({ sourceRun, identity, folder, totalBytes }) {
  const preferredType = sourceRun.artifactType || expectedArtifactType(sourceRun.deliveryMode)
  const artifact = findRunArtifact(folder, preferredType)
  if (!artifact) throw new Error('找不到可渲染的 HTML、SVG 或 Markdown 入口')
  const now = new Date().toISOString()
  const project = String(sourceRun.project || '').trim() || path.dirname(folder)
  const run = {
    id: crypto.randomUUID(),
    sourceRunId: sourceRun.id || null,
    batchId: sourceRun.batchId || null,
    agentId: sourceRun.agentId || 'unknown',
    agentName: sourceRun.agentName || sourceRun.agentId || 'Unknown Agent',
    model: sourceRun.model || null,
    resolvedModel: sourceRun.resolvedModel || null,
    providerName: sourceRun.providerName || null,
    modelMode: sourceRun.modelMode || 'default',
    color: sourceRun.color || '#d4ff4f',
    project,
    prompt: String(sourceRun.prompt || '').slice(0, 20000),
    folder,
    entry: artifact.entry,
    artifactType: artifact.type,
    expectedArtifactType: sourceRun.expectedArtifactType || preferredType || null,
    deliveryMode: normalizeDeliveryMode(sourceRun.deliveryMode, 'custom'),
    deliveryConstraint: sourceRun.deliveryConstraint || null,
    interaction: sourceRun.interaction || null,
    status: 'done',
    publish: true,
    publishState: 'published',
    publishSource: 'community-api',
    publishedAt: now,
    publishedBytes: totalBytes,
    user: identity.email,
    category: CATEGORIES.includes(sourceRun.category) ? sourceRun.category : classifyHeuristic(sourceRun.prompt),
    metrics: sourceRun.metrics || null,
    createdAt: sourceRun.createdAt || now,
    startedAt: sourceRun.startedAt || null,
    endedAt: sourceRun.endedAt || now,
    exitCode: sourceRun.exitCode ?? 0,
  }
  runs.unshift(run)
  if (identity.email) {
    users[identity.email] = {
      ...users[identity.email],
      name: identity.name || users[identity.email]?.name || identity.email.split('@')[0],
      picture: identity.picture || users[identity.email]?.picture || null,
    }
    saveUsers()
  }
  saveRegistry()
  broadcast({ type: 'run', run: publicRun(run) })
  capturePreview(run)
  autoCommitRun(run)
  return run
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

const FABLE5_FAVORITES_FILE = path.join(DATA_DIR, 'fable5-favorites.json')
let fable5Favorites = {}
if (fs.existsSync(FABLE5_FAVORITES_FILE)) {
  try {
    fable5Favorites = JSON.parse(fs.readFileSync(FABLE5_FAVORITES_FILE, 'utf8'))
  } catch {}
}
const saveFable5Favorites = () => fs.writeFileSync(FABLE5_FAVORITES_FILE, JSON.stringify(fable5Favorites, null, 2))

const FABLE5_TRANSLATIONS_FILE = path.join(DATA_DIR, 'fable5-translations.json')
let fable5Translations = {}
if (fs.existsSync(FABLE5_TRANSLATIONS_FILE)) {
  try {
    fable5Translations = JSON.parse(fs.readFileSync(FABLE5_TRANSLATIONS_FILE, 'utf8'))
  } catch {}
}
const saveFable5Translations = () => fs.writeFileSync(FABLE5_TRANSLATIONS_FILE, JSON.stringify(fable5Translations, null, 2))

function sanitizeFavoriteIds(ids) {
  if (!Array.isArray(ids)) return []
  return [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 5000)
}

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

wss.on('connection', (socket, req) => {
  if (!edgeProxyAuthorized(req)) {
    socket.close(1008, 'Touchstone edge authentication required')
    return
  }
  socket.touchstoneEmail = currentSession(req)?.email || null
})

function authorizedRun(req, res, mode = 'read') {
  const run = runs.find((item) => item.id === req.params.id)
  if (!run) {
    res.status(404).json({ error: 'not found' })
    return null
  }
  const email = currentSession(req)?.email || null
  const allowed = mode === 'manage' ? canManageRun(run, email) : canReadRun(run, email)
  if (!allowed) {
    res.status(email ? 403 : 401).json({ error: email ? '无权访问这个任务' : '请先登录' })
    return null
  }
  return run
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
    session.sessions[sid] = {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      idToken: token.id_token || null,
      createdAt: Date.now(),
    }
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
  const access = requireRunnerOwner(req, res)
  if (!access) return
  const { prompt, runners, publish, deliveryConstraint } = req.body || {}
  const selectedSkills = [...new Set(
    (Array.isArray(req.body?.selectedSkills) ? req.body.selectedSkills : [])
      .map((skill) => String(skill || '').trim())
      .filter(Boolean)
  )].slice(0, MAX_SELECTED_SKILLS)
  let { project } = req.body || {}
  if (typeof prompt !== 'string' || !prompt.trim() || !Array.isArray(runners) || runners.length === 0) {
    return res.status(400).json({ error: 'prompt 和至少一个 runner 必填' })
  }
  const sessionUser = currentSession(req)
  const user = access.email
  const cfg = loadAgentsConfig()
  const deliveryMode = normalizeDeliveryMode(req.body?.deliveryMode)
  const plannedRunners = await Promise.all(runners.map(async (runner) => {
    const agent = cfg.agents.find((item) => item.id === runner?.agentId)
    if (!agent) return { runner, error: `未知 Agent：${runner?.agentId || ''}` }
    const model = typeof runner.model === 'string' ? runner.model.trim() : ''
    const providerId = typeof runner.providerId === 'string' ? runner.providerId.trim() : ''
    const strictModel = runner.strictModel !== false
    const provider = providerId ? providerRegistry.resolve(user, providerId) : null
    const validationModel = model || probeDefaultModel(agent.id) || ''
    const capability = await getAgentCapability(agent)
    let error = null
    if (providerId && !provider) error = '选择的 Provider 不存在或不属于当前用户'
    else if (provider && agent.id !== 'claude') error = '自定义 Anthropic Provider 目前仅支持 Claude Code'
    else if (provider && !model) error = '使用自定义 Provider 时必须选择模型'
    else if (provider && (!capability.health.installed || !capability.health.compatible)) {
      error = capability.health.fix || `${agent.name} 未安装或版本不兼容`
    } else if (provider && capability.health.modelHealth?.[model]?.available === false) {
      error = capability.health.modelHealth[model].fix || `${model} 当前不可用`
    } else if (!provider) {
      error = validateAgentSelection(agent, capability, validationModel)
    }
    return {
      runner,
      agent,
      model,
      provider,
      strictModel,
      capability,
      error,
    }
  }))
  const compatibilityErrors = plannedRunners.filter((item) => item.error).map((item) => item.error)
  if (compatibilityErrors.length) {
    return res.status(409).json({
      error: `本地 Agent 预检失败：${compatibilityErrors.join('；')}`,
      issues: compatibilityErrors,
    })
  }
  const skillIssues = selectedSkillIssues(
    selectedSkills,
    listLocalSkills(),
    [...new Set(plannedRunners.map((item) => item.agent.id))]
  )
  if (skillIssues.length) {
    return res.status(409).json({
      error: `本地 Skill 预检失败：${skillIssues.join('；')}`,
      issues: skillIssues,
    })
  }
  let category = null
  if (!project || !String(project).trim()) {
    const named = await autoNameProject(prompt)
    project = named.name
    category = named.category
  }
  if (!category) category = classifyHeuristic(prompt)
  const deliveryDefaults = {
    'single-html': cfg.defaults.singleHtmlArtifactHint,
    'single-svg': cfg.defaults.singleSvgArtifactHint,
    'single-markdown': cfg.defaults.singleMarkdownArtifactHint,
    'static-folder': cfg.defaults.artifactHint,
  }
  const finalDeliveryConstraint = normalizeDeliveryConstraint(
    deliveryConstraint,
    deliveryDefaults[deliveryMode] || cfg.defaults.singleHtmlArtifactHint || cfg.defaults.artifactHint
  )
  // Skill 的 `/<name>` 必须是整个 prompt 的第一个 token，CLI 才会展开它。
  // 只有支持 slash 展开的 Agent 才加前缀；其他 Agent 拿到不带前缀的原始
  // prompt，而不是一个它读不懂的字面 `/xxx`。
  const promptBody = `${prompt.trim()}\n\n【交付要求】\n${finalDeliveryConstraint}`
  const promptFor = (agentId) =>
    (agentLoadsSkills(agentId) ? buildSelectedSkillsPrefix(selectedSkills) : '') + promptBody
  const batchId = crypto.randomUUID()
  const created = []
  // 目录要到真正启动时才创建，所以排队中的 run 在磁盘上还不存在。只查文件系统
  // 会让两个排队的 run 拿到同一个名字并互相覆盖，所以把本批已分配的名字和所有
  // 尚未落盘的 run 一起算进去。
  const claimedFolders = new Set(
    runs.filter((item) => item.status === 'queued' || item.status === 'pending').map((item) => item.folder)
  )

  for (const plan of plannedRunners) {
    const { agent, capability, model, provider, strictModel } = plan
    // 目录结构：runs/<项目>/<模型>，同名冲突时追加 _2、_3…
    const projectSlug = slugify(project)
    const base = model ? `${agent.id}-${slugify(model)}` : agent.id
    const folder = allocateRunFolder(projectSlug, base, {
      claimed: claimedFolders,
      exists: (project, name) => fs.existsSync(path.join(RUNS_DIR, project, name)),
    })
    const run = {
      id: crypto.randomUUID(),
      batchId,
      agentId: agent.id,
      agentName: agent.name,
      model: model || null,
      resolvedModel: model ? null : probeDefaultModel(agent.id),
      providerName: provider?.name || null,
      modelMode: provider ? (strictModel ? 'strict' : 'routed') : 'default',
      color: agent.color,
      project: String(project).trim(),
      prompt,
      folder,
      entry: null,
      artifactType: null,
      expectedArtifactType: expectedArtifactType(deliveryMode),
      status: 'pending',
      publish: !!publish,
      publishState: publish ? 'pending' : 'local',
      user,
      category,
      // 只记录这个 Agent 真正会加载的 Skill，卡片上就不会出现假绿灯。
      selectedSkills: agentLoadsSkills(agent.id) ? selectedSkills : [],
      deliveryMode,
      deliveryConstraint: finalDeliveryConstraint,
      interaction: agent.interaction || { input: false, questions: false, progress: true, mode: 'one-shot' },
      createdAt: new Date().toISOString(),
    }
    runs.unshift(run)
    if (run.publish && sessionUser?.idToken) publishCredentials.set(run.id, { idToken: sessionUser.idToken })
    created.push(run)
    enqueueRun({
      run,
      agent: { ...agent, command: capability.executable },
      prompt: promptFor(agent.id),
      timeoutMinutes: cfg.defaults.timeoutMinutes || 20,
      runtimeEnv: providerRuntimeEnv(provider, model, strictModel),
    })
  }
  saveRegistry()
  res.json({ batchId, project, runs: created.map(publicRun) })
})

app.get('/api/runs', (req, res) => {
  const email = currentSession(req)?.email || null
  const visibleRuns = visibleRunsFor(runs, email)
  const visibleEmails = new Set(visibleRuns.map((run) => run.user).filter(Boolean))
  const visibleUsers = Object.fromEntries(Object.entries(users).filter(([userEmail]) => visibleEmails.has(userEmail) || userEmail === email))
  res.json({ runs: visibleRuns.map(publicRun), views: stats.views, projectLikes: stats.projectLikes, users: visibleUsers })
})

app.post('/api/publish', async (req, res) => {
  let folder = null
  try {
    if (req.body?.schema !== 1) return res.status(400).json({ error: 'unsupported publish schema' })
    const identity = await publishIdentity(req, req.body)
    if (!identity?.email) return res.status(401).json({ error: 'publish auth required' })
    const { files, totalBytes } = validatePublishFiles(req.body.files)
    const sourceRun = req.body.run || {}
    const project = String(sourceRun.project || '').trim() || 'untitled'
    const model = sourceRun.model || sourceRun.resolvedModel || sourceRun.agentId || 'run'
    folder = uniquePublishedFolder(project, `${sourceRun.agentId || 'agent'}-${model}`)
    writePublishedFiles(folder, files)
    const run = registerPublishedRun({ sourceRun: { ...sourceRun, project }, identity, folder, totalBytes })
    const folderPath = run.folder.split('/').map(encodeURIComponent).join('/')
    const entryPath = run.entry.split('/').map(encodeURIComponent).join('/')
    res.json({
      ok: true,
      run: publicRun(run),
      url: `${requestOrigin(req)}/p/${encodeURIComponent(run.project)}`,
      workspaceUrl: `${requestOrigin(req)}/workspace/${folderPath}/${entryPath}`,
    })
  } catch (err) {
    if (folder) fs.rmSync(path.join(RUNS_DIR, folder), { recursive: true, force: true })
    console.error('[publish] 接收失败：', err)
    res.status(400).json({ error: err?.message || String(err) })
  }
})

app.get('/api/fable5/favorites', async (req, res) => {
  const email = await getGoogleAccount(req)
  if (!email) return res.status(401).json({ error: '请先登录 Google 账号' })
  res.json({ favorites: sanitizeFavoriteIds(fable5Favorites[email] || []) })
})

app.put('/api/fable5/favorites', async (req, res) => {
  const email = await getGoogleAccount(req)
  if (!email) return res.status(401).json({ error: '请先登录 Google 账号' })
  fable5Favorites[email] = sanitizeFavoriteIds(req.body?.favorites)
  saveFable5Favorites()
  res.json({ favorites: fable5Favorites[email] })
})

app.post('/api/fable5/favorites/:id', async (req, res) => {
  const email = await getGoogleAccount(req)
  if (!email) return res.status(401).json({ error: '请先登录 Google 账号' })
  const id = String(req.params.id || '').trim()
  if (!id) return res.status(400).json({ error: 'id required' })
  const current = new Set(sanitizeFavoriteIds(fable5Favorites[email] || []))
  const favorite = req.body?.favorite !== false
  favorite ? current.add(id) : current.delete(id)
  fable5Favorites[email] = sanitizeFavoriteIds([...current])
  saveFable5Favorites()
  res.json({ favorite, favorites: fable5Favorites[email] })
})

app.post('/api/fable5/translations', async (req, res) => {
  const language = normalizeFable5TranslationLanguage(req.body?.language)
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : []
  const items = rawItems
    .slice(0, FABLE5_TRANSLATION_BATCH_LIMIT)
    .map((item) => ({
      id: String(item?.id || '').trim(),
      title: cleanFable5TranslationField(item?.title),
      summary: cleanFable5TranslationField(item?.summary),
    }))
    .filter((item) => item.id && (item.title || item.summary))

  if (!items.length) return res.json({ language, translations: {} })

  const translations = {}
  const pending = []
  for (const item of items) {
    const cached = getCachedFable5Translation(language, item)
    if (cached) translations[item.id] = cached
    else pending.push(item)
  }

  if (pending.length) {
    const resolved = await translateFable5Batch(language, pending)
    for (const item of pending) {
      const translated = resolved[item.id] || {
        title: cleanFable5TranslationField(item.title),
        summary: cleanFable5TranslationField(item.summary),
      }
      const cached = setCachedFable5Translation(language, item, translated)
      translations[item.id] = { title: cached.title, summary: cached.summary }
    }
    saveFable5Translations()
  }

  res.json({ language, translations })
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
  const run = authorizedRun(req, res)
  if (!run) return
  const delta = req.body?.action === 'unlike' ? -1 : 1
  stats.likes[run.id] = Math.max(0, (stats.likes[run.id] || 0) + delta)
  saveStats()
  broadcast({ type: 'run', run: publicRun(run) })
  res.json({ likes: stats.likes[run.id] })
})

app.get('/api/runs/:id/preview', (req, res) => {
  const run = authorizedRun(req, res)
  if (!run) return
  const f = previewPath(run)
  if (!fs.existsSync(f)) return res.status(404).json({ error: 'no preview' })
  res.setHeader('Cache-Control', 'no-store')
  res.type('png').send(fs.readFileSync(f))
})

app.get('/api/runs/:id/artifact', (req, res) => {
  const run = authorizedRun(req, res)
  if (!run) return
  const entry = safeRelativePath(run.entry)
  const type = run.artifactType || artifactTypeForEntry(entry)
  if (!entry || !type) return res.status(404).json({ error: 'no artifact' })
  const root = path.join(RUNS_DIR, run.folder)
  const absolute = path.resolve(root, entry)
  if (!absolute.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolute)) {
    return res.status(404).json({ error: 'artifact missing' })
  }
  if (type !== 'markdown') return res.json({ entry, type })
  const stat = fs.statSync(absolute)
  if (stat.size > 2 * 1024 * 1024) return res.status(413).json({ error: 'Markdown artifact is too large to preview' })
  res.setHeader('Cache-Control', 'no-store')
  res.json({ entry, type, content: fs.readFileSync(absolute, 'utf8') })
})

app.get('/api/runs/:id/log', (req, res) => {
  const run = authorizedRun(req, res, 'manage')
  if (!run) return
  const logFile = path.join(RUNS_DIR, run.folder, '.touchstone.log')
  res.type('text/plain; charset=utf-8')
  if (fs.existsSync(logFile)) res.send(fs.readFileSync(logFile, 'utf8'))
  else res.send('')
})

app.get('/api/runs/:id/events', (req, res) => {
  const run = authorizedRun(req, res, 'manage')
  if (!run) return
  const eventsFile = path.join(RUNS_DIR, run.folder, '.touchstone-events.jsonl')
  const byId = new Map()
  if (fs.existsSync(eventsFile)) {
    for (const line of fs.readFileSync(eventsFile, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line)
        const previous = byId.get(event.id) || {}
        byId.set(event.id, { ...previous, ...event })
      } catch {}
    }
  }
  res.json({ events: [...byId.values()] })
})

app.post('/api/runs/:id/input', (req, res) => {
  const run = authorizedRun(req, res, 'manage')
  if (!run) return
  const live = liveProcs.get(run.id)
  if (!live) return res.status(409).json({ error: '任务当前没有运行' })
  const answer = String(req.body?.answer || '').trim()
  const questionId = String(req.body?.questionId || '').trim()
  if (!answer || !questionId) return res.status(400).json({ error: '缺少回答或问题 ID' })
  if (!live.agent.interaction?.input || live.agent.inputFormat !== 'claude-stream-json' || !live.proc.stdin?.writable) {
    return res.status(409).json({
      error: `当前 ${live.agent.name} 使用一次性 CLI 模式；需要 ${live.agent.interaction?.upgrade || '原生会话协议'} 才能运行中回复`,
    })
  }
  const input = {
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'text', text: `Answer to pending question ${questionId}: ${answer}` }],
    },
  }
  live.proc.stdin.write(`${JSON.stringify(input)}\n`)
  live.emitEvent({
    id: questionId,
    kind: 'question',
    status: 'answered',
    answer,
    timestamp: new Date().toISOString(),
  })
  res.json({ ok: true })
})

app.get('/api/runs/:id/files', (req, res) => {
  const run = authorizedRun(req, res, 'manage')
  if (!run) return
  res.json({ files: listFiles(run.folder) })
})

app.post('/api/runs/:id/stop', (req, res) => {
  const run = authorizedRun(req, res, 'manage')
  if (!run) return
  const live = liveProcs.get(run.id)
  if (live) {
    run.status = 'stopped'
    live.proc.kill('SIGTERM')
    setTimeout(() => live.proc.kill('SIGKILL'), 5000).unref()
  } else if (run.status === 'queued' && dropFromRunQueue(run.id)) {
    // 还没轮到的任务直接出队，不占名额。
    run.status = 'stopped'
    delete run.queuePosition
    run.endedAt = new Date().toISOString()
    broadcast({ type: 'run', run: publicRun(run) })
    drainRunQueue()
  }
  saveRegistry()
  res.json({ ok: true })
})

app.delete('/api/runs/:id', (req, res) => {
  const idx = runs.findIndex((r) => r.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  const run = runs[idx]
  const email = currentSession(req)?.email || null
  if (!canManageRun(run, email)) return res.status(email ? 403 : 401).json({ error: email ? '无权删除这个任务' : '请先登录' })
  if (liveProcs.get(run.id)) {
    return res.status(400).json({ error: '请先停止运行中的任务' })
  }
  dropFromRunQueue(run.id)
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
  broadcast({ type: 'removed', runId: run.id }, run)
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
  const collectionUpdatedAt = Object.fromEntries(
    Object.entries(COLLECTION_ROUTES).map(([pathname, config]) => [
      pathname,
      routeCollectionUpdatedAt(config),
    ])
  )
  const publishedRuns = runs.filter(isRunPublished)
  const homeUpdatedAt = latestIsoValue([latestIso(publishedRuns), ...Object.values(collectionUpdatedAt), serverModifiedIso()])
  const urls = [
    { loc: `${origin}/`, priority: '1.0', changefreq: 'weekly', lastmod: homeUpdatedAt },
    { loc: `${origin}/fable5`, priority: '0.9', changefreq: 'weekly', lastmod: collectionUpdatedAt['/fable5'] },
    { loc: `${origin}/gpt5-6`, priority: '0.9', changefreq: 'weekly', lastmod: collectionUpdatedAt['/gpt5-6'] },
    { loc: `${origin}/figma-motion`, priority: '0.8', changefreq: 'weekly', lastmod: collectionUpdatedAt['/figma-motion'] },
    { loc: `${origin}/ios-apps`, priority: '0.8', changefreq: 'weekly', lastmod: collectionUpdatedAt['/ios-apps'] },
    { loc: `${origin}/oss-radar`, priority: '0.8', changefreq: 'weekly', lastmod: collectionUpdatedAt['/oss-radar'] },
  ]
  const projects = new Map()
  for (const run of publishedRuns) {
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
  const publishedUsers = new Set(publishedRuns.map((run) => run.user).filter(Boolean))
  for (const [email, profile] of Object.entries(users).filter(([email]) => publishedUsers.has(email))) {
    urls.push({
      loc: `${origin}/u/${encodeURIComponent(email)}`,
      priority: '0.5',
      changefreq: 'monthly',
      lastmod: profile.updatedAt || latestIso(publishedRuns.filter((r) => r.user === email)),
    })
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (u) =>
        `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${escapeXml(u.lastmod.slice(0, 10))}</lastmod>` : ''}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join('\n')}\n</urlset>\n`
  res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate')
  res.type('application/xml; charset=utf-8').send(body)
})

// 作品静态托管：私有 run 仅所有者可读；已发布作品使用独立的 sandbox origin。
const WORKSPACE_CAPTURE_TOKEN = crypto.randomBytes(32).toString('base64url')
const WORKSPACE_CAPTURE_COOKIE = 'touchstone_workspace_capture'

function workspaceRunForPath(requestPath) {
  const relative = safeDecodeURIComponent(String(requestPath || '')).replace(/^\/+/, '')
  return [...runs]
    .sort((left, right) => right.folder.length - left.folder.length)
    .find((run) => relative === run.folder || relative.startsWith(`${run.folder}/`))
}

app.use('/workspace', (req, res, next) => {
  const run = workspaceRunForPath(req.path)
  if (!run) return res.status(404).type('text/plain; charset=utf-8').send('not found')
  const captureQuery = String(req.query.__capture || '')
  if (captureQuery === WORKSPACE_CAPTURE_TOKEN) {
    res.setHeader(
      'Set-Cookie',
      `${WORKSPACE_CAPTURE_COOKIE}=${WORKSPACE_CAPTURE_TOKEN}; HttpOnly; SameSite=Strict; Path=/workspace; Max-Age=120`
    )
  }
  const captureAllowed =
    captureQuery === WORKSPACE_CAPTURE_TOKEN || parseCookies(req)[WORKSPACE_CAPTURE_COOKIE] === WORKSPACE_CAPTURE_TOKEN
  const email = currentSession(req)?.email || null
  if (!captureAllowed && !canReadRun(run, email)) {
    return res.status(email ? 403 : 401).type('text/plain; charset=utf-8').send(email ? 'forbidden' : 'login required')
  }
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  res.setHeader(
    'Content-Security-Policy',
    [
      'sandbox allow-scripts allow-modals allow-pointer-lock allow-popups allow-downloads',
      "default-src 'self' data: blob:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline' data:",
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ')
  )
  next()
})

app.use(
  '/workspace',
  express.static(RUNS_DIR, {
    index: 'index.html',
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-store')
    },
  })
)

function setPublicAssetCacheHeaders(res, filePath) {
  const normalized = filePath.split(path.sep).join('/')
  if (
    normalized.includes('/fable5-media/') ||
    normalized.includes('/fable5-avatars/') ||
    normalized.includes('/gpt5-6-media/') ||
    normalized.includes('/gpt5-6-avatars/') ||
    normalized.includes('/figma-motion-media/') ||
    normalized.includes('/figma-motion-avatars/') ||
    normalized.includes('/ios-apps-media/') ||
    normalized.includes('/ios-apps-avatars/')
  ) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return
  }
  if (
    normalized.endsWith('/fable5-data/index.json') ||
    normalized.endsWith('/gpt5-6-data/index.json') ||
    normalized.endsWith('/figma-motion-data/index.json') ||
    normalized.endsWith('/ios-apps-data/index.json')
  ) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate')
    return
  }
  if (
    normalized.includes('/fable5-data/') ||
    normalized.includes('/gpt5-6-data/') ||
    normalized.includes('/figma-motion-data/') ||
    normalized.includes('/ios-apps-data/')
  ) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate')
  }
}

function setDistCacheHeaders(res, filePath) {
  const normalized = filePath.split(path.sep).join('/')
  if (normalized.includes('/assets/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  }
}

// web public 优先于 dist：fable5 数据/媒体由脚本直接写入 public，更新后无需重新构建
app.use(express.static(WEB_PUBLIC_DIR, { index: false, maxAge: '5m', setHeaders: setPublicAssetCacheHeaders }))

// 生产模式：托管前端构建产物
if (fs.existsSync(WEB_DIST_DIR)) {
  app.use(express.static(WEB_DIST_DIR, { index: false, setHeaders: setDistCacheHeaders }))
  app.get(/^\/(?!api|ws|workspace|avatars).*/, (req, res) => {
    const indexHtml = fs.readFileSync(path.join(WEB_DIST_DIR, 'index.html'), 'utf8')
    const seo = seoForPath(req)
    res.setHeader('Cache-Control', 'no-store, must-revalidate')
    res.status(seo.found ? 200 : 404).type('html').send(renderSeoHtml(indexHtml, seo))
  })
}

httpServer.listen(PORT, () => {
  console.log(`Touchstone server: http://localhost:${PORT}`)
  // 预热 CLI 探测缓存。冷探测要几秒，会超过边缘代理的 origin 超时，
  // 让首个访问者看到「本地执行器离线」。启动时先跑一遍，首屏就命中缓存。
  loadAgentsConfig()
    .agents.forEach((agent) => {
      getAgentCapability(agent).catch(() => {})
    })
  // 回填：旧 run 的分类与缩略图（截图需要服务已就绪）
  for (const r of runs) {
    if (!r.category) r.category = classifyHeuristic(r.prompt)
    if (r.entry && !r.artifactType) r.artifactType = artifactTypeForEntry(r.entry)
    if (!r.entry && r.status === 'done') {
      const artifact = findRunArtifact(r.folder, r.expectedArtifactType)
      r.entry = artifact?.entry || null
      r.artifactType = artifact?.type || null
    }
    if (r.status === 'done' && r.entry) {
      r.preview = fs.existsSync(previewPath(r))
      if (!r.preview) capturePreview(r)
    }
  }
  saveRegistry()
})
