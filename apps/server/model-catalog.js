const MODELS_DEV_URL = 'https://models.dev/api.json'
const CATALOG_LIMIT = 500

function clean(value, max = 240) {
  return String(value || '').trim().slice(0, max)
}

function compactModel(id, model) {
  return {
    id: clean(id),
    name: clean(model?.name || id),
    family: clean(model?.family),
    reasoning: Boolean(model?.reasoning),
    toolCall: Boolean(model?.tool_call),
    attachment: Boolean(model?.attachment),
    status: clean(model?.status),
    releaseDate: clean(model?.release_date),
    lastUpdated: clean(model?.last_updated),
    context: Number(model?.limit?.context) || null,
    output: Number(model?.limit?.output) || null,
  }
}

export function normalizeModelsDevCatalog(payload, providerId) {
  const provider = payload?.[providerId]
  if (!provider || typeof provider !== 'object') return null
  const models = Object.entries(provider.models || {})
    .map(([id, model]) => compactModel(id, model))
    .filter((model) => model.id && model.status !== 'deprecated')
    .sort((left, right) => {
      const toolDifference = Number(right.toolCall) - Number(left.toolCall)
      if (toolDifference) return toolDifference
      return right.lastUpdated.localeCompare(left.lastUpdated) || left.name.localeCompare(right.name)
    })
    .slice(0, CATALOG_LIMIT)
  return {
    providerId,
    name: clean(provider.name || providerId, 80),
    api: clean(provider.api, 2000),
    logoUrl: `https://models.dev/logos/${encodeURIComponent(providerId)}.svg`,
    sourceUrl: MODELS_DEV_URL,
    models,
  }
}

export class ModelCatalog {
  constructor(options = {}) {
    this.url = options.url || MODELS_DEV_URL
    this.ttlMs = options.ttlMs || 6 * 60 * 60 * 1000
    this.fetchJson = options.fetchJson
    this.now = options.now || Date.now
    this.cache = null
  }

  async provider(providerId) {
    const now = this.now()
    if (!this.cache || now - this.cache.at >= this.ttlMs) {
      if (!this.fetchJson) throw new Error('模型目录抓取器未配置')
      this.cache = { at: now, payload: await this.fetchJson(this.url) }
    }
    return normalizeModelsDevCatalog(this.cache.payload, providerId)
  }
}
