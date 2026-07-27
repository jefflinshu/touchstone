import fs from 'node:fs'
import crypto from 'node:crypto'

const AUTH_MODES = new Set(['auth-token', 'api-key'])
const MAX_MODELS = 500
const PROVIDER_PRESETS = new Map([
  [
    'zenmux-coding-plan',
    {
      id: 'zenmux-coding-plan',
      name: 'ZenMux Coding Plan',
      providerId: 'zenmux',
      baseUrl: 'https://zenmux.ai/api/anthropic',
      authMode: 'auth-token',
      docsUrl: 'https://zenmux.ai/docs/zh/best-practices/claude-code.html',
      modelsDevUrl: 'https://models.dev/providers/zenmux',
    },
  ],
])

function cleanString(value, max) {
  return String(value || '').trim().slice(0, max)
}

export function normalizeProviderUrl(value) {
  const raw = cleanString(value, 2000)
  if (!raw) throw new Error('Provider Base URL 必填')
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Provider Base URL 无效')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Provider Base URL 仅支持 http 或 https')
  }
  if (url.username || url.password) throw new Error('Provider Base URL 不能包含用户名或密码')
  return url.href.replace(/\/+$/, '')
}

export function normalizeProviderModels(value) {
  const input = Array.isArray(value) ? value : String(value || '').split(/[\n,]/)
  return [
    ...new Set(
      input
        .map((item) => cleanString(item, 240))
        .filter((item) => item && !/[\u0000-\u001f\u007f]/.test(item))
    ),
  ].slice(0, MAX_MODELS)
}

function publicProvider(provider) {
  const preset = PROVIDER_PRESETS.get(provider.presetId)
  return {
    id: provider.id,
    presetId: preset?.id || null,
    name: provider.name,
    baseUrl: provider.baseUrl,
    authMode: provider.authMode,
    models: provider.models,
    docsUrl: preset?.docsUrl || null,
    catalogProviderId: preset?.providerId || null,
    hasCredential: Boolean(provider.credential),
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  }
}

function safeRead(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(parsed.providers) ? parsed.providers : []
  } catch {
    return []
  }
}

function safeWrite(file, providers) {
  const temp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(temp, `${JSON.stringify({ providers }, null, 2)}\n`, { mode: 0o600 })
  fs.renameSync(temp, file)
  try {
    fs.chmodSync(file, 0o600)
  } catch {}
}

export class ProviderRegistry {
  constructor(file, options = {}) {
    this.file = file
    this.now = options.now || (() => new Date().toISOString())
    this.id = options.id || (() => crypto.randomUUID())
  }

  all() {
    return safeRead(this.file)
  }

  list(user) {
    return this.all()
      .filter((provider) => provider.user === user)
      .map(publicProvider)
      .sort((left, right) => left.name.localeCompare(right.name))
  }

  resolve(user, id) {
    const provider = this.all().find((item) => item.user === user && item.id === id)
    return provider || null
  }

  upsert(user, input) {
    if (!user) throw new Error('Provider 必须绑定登录用户')
    const providers = this.all()
    const existing = input?.id
      ? providers.find((item) => item.user === user && item.id === input.id)
      : null
    if (input?.id && !existing) throw new Error('Provider 不存在')
    const requestedPresetId = cleanString(input?.presetId, 80)
    const preset = PROVIDER_PRESETS.get(requestedPresetId) || null
    if (requestedPresetId && !preset) throw new Error('未知的 Provider 预设')
    if (existing?.presetId && requestedPresetId && existing.presetId !== requestedPresetId) {
      throw new Error('不能修改已有 Provider 的预设类型')
    }
    const activePreset = preset || PROVIDER_PRESETS.get(existing?.presetId) || null
    const name = cleanString(input?.name, 80) || activePreset?.name || ''
    if (!name) throw new Error('Provider 名称必填')
    const credential = cleanString(input?.credential, 8192) || existing?.credential || ''
    if (!credential) throw new Error('Provider Token 必填')
    const authMode =
      activePreset?.authMode ||
      (AUTH_MODES.has(input?.authMode) ? input.authMode : existing?.authMode || 'auth-token')
    const now = this.now()
    const provider = {
      id: existing?.id || this.id(),
      user,
      presetId: activePreset?.id || null,
      name,
      baseUrl: normalizeProviderUrl(activePreset?.baseUrl || input?.baseUrl),
      authMode,
      credential,
      models: normalizeProviderModels(input?.models),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }
    const index = existing ? providers.indexOf(existing) : -1
    if (index >= 0) providers[index] = provider
    else providers.push(provider)
    safeWrite(this.file, providers)
    return publicProvider(provider)
  }

  replaceModels(user, id, models) {
    const providers = this.all()
    const index = providers.findIndex((item) => item.user === user && item.id === id)
    if (index < 0) throw new Error('Provider 不存在')
    providers[index] = {
      ...providers[index],
      models: normalizeProviderModels(models),
      updatedAt: this.now(),
    }
    safeWrite(this.file, providers)
    return publicProvider(providers[index])
  }

  remove(user, id) {
    const providers = this.all()
    const next = providers.filter((item) => item.user !== user || item.id !== id)
    if (next.length === providers.length) return false
    safeWrite(this.file, next)
    return true
  }
}

export function listProviderPresets() {
  return [...PROVIDER_PRESETS.values()].map((preset) => ({ ...preset }))
}

export function providerRuntimeEnv(provider, model, strictModel = true) {
  if (!provider) return {}
  const selectedModel = cleanString(model, 240)
  const env = {
    ANTHROPIC_BASE_URL: provider.baseUrl,
    ANTHROPIC_API_KEY: provider.authMode === 'api-key' ? provider.credential : '',
    ANTHROPIC_AUTH_TOKEN: provider.authMode === 'auth-token' ? provider.credential : '',
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
    CLAUDE_CODE_ATTRIBUTION_HEADER: '0',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  }
  if (strictModel && selectedModel) {
    env.ANTHROPIC_MODEL = selectedModel
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = selectedModel
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = selectedModel
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = selectedModel
    env.CLAUDE_CODE_SUBAGENT_MODEL = selectedModel
  }
  return env
}

export function providerRequestHeaders(provider) {
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  }
  if (provider.authMode === 'api-key') headers['x-api-key'] = provider.credential
  else headers.authorization = `Bearer ${provider.credential}`
  return headers
}

export function modelDiscoveryUrls(baseUrl) {
  const base = normalizeProviderUrl(baseUrl)
  const urls = base.endsWith('/v1')
    ? [`${base}/models`]
    : [`${base}/v1/models`, `${base}/models`]
  return [...new Set(urls)]
}

export function parseDiscoveredModels(payload) {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.models)
        ? payload.models
        : []
  return normalizeProviderModels(
    candidates.map((item) => (typeof item === 'string' ? item : item?.id || item?.name || ''))
  )
}
