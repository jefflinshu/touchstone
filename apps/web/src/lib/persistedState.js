// 任务表单的本机持久化。刷新页面不该丢掉参赛者配置、草稿和挂载的 Skill。
//
// 存下来的东西会过期：Provider 可能被删掉，模型可能从 Provider 里下架，CLI 可能
// 被卸载。所以读取时一律按当前 /api/agents 与 /api/providers 的真实情况过滤，
// 而不是直接信任磁盘上的内容。

const PREFIX = 'touchstone:'

// 新键统一加前缀；早于本模块存在的键（例如 touchstone-delivery-constraint）
// 传 { raw: true } 按原名读写，避免升级后丢掉用户已保存的内容。
function resolve(key, options) {
  return options?.raw ? key : PREFIX + key
}

export function readJson(key, fallback = null, options) {
  try {
    const raw = localStorage.getItem(resolve(key, options))
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    // 手改过、被别的标签页写坏、或 Safari 隐私模式下不可用时都走这里。
    return fallback
  }
}

export function writeJson(key, value, options) {
  try {
    localStorage.setItem(resolve(key, options), JSON.stringify(value))
  } catch {}
}

export function readString(key, fallback = '', options) {
  try {
    return localStorage.getItem(resolve(key, options)) ?? fallback
  } catch {
    return fallback
  }
}

export function writeString(key, value, options) {
  try {
    localStorage.setItem(resolve(key, options), String(value))
  } catch {}
}

// 把存下来的 runner 恢复成可用配置：丢掉已不存在的 Agent 和 Provider，
// 并且只保留该 Agent/Provider 当前真的提供的模型。
export function restoreRunners(stored, { agents, providers, nextKey }) {
  if (!Array.isArray(stored) || !agents.length) return []
  const agentById = new Map(agents.map((agent) => [agent.id, agent]))
  const providerById = new Map(providers.map((provider) => [provider.id, provider]))

  return stored
    .map((entry) => {
      const agent = agentById.get(entry?.agentId)
      if (!agent) return null
      // Provider 被删掉后就退回该 CLI 自己的账号，而不是留一个悬空引用。
      const provider = entry?.providerId ? providerById.get(entry.providerId) : null
      const providerId = provider ? provider.id : ''
      const allowedModels = provider ? provider.models || [] : agent.models || []
      const model = allowedModels.includes(entry?.model) ? entry.model : allowedModels[0] || ''
      return {
        key: nextKey(),
        agentId: agent.id,
        model,
        providerId,
        strictModel: entry?.strictModel !== false,
      }
    })
    .filter(Boolean)
}

export function restoreSelectedSkills(stored, { skills, capableAgentIds, max }) {
  if (!Array.isArray(stored) || !capableAgentIds.length) return []
  const byId = new Map(skills.map((skill) => [skill.id, skill]))
  return stored
    .filter((id) => {
      const skill = byId.get(id)
      return skill?.loadable && capableAgentIds.every((agentId) => skill.installedFor?.includes(agentId))
    })
    .slice(0, max)
}
