import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const AGENT_SKILL_TARGETS = {
  claude: {
    installerId: 'claude-code',
    roots: ['.claude/skills'],
  },
  codex: {
    installerId: 'codex',
    roots: ['.codex/skills', '.agents/skills'],
  },
  gemini: {
    installerId: 'gemini-cli',
    roots: ['.gemini/skills'],
  },
  opencode: {
    installerId: 'opencode',
    roots: ['.config/opencode/skills'],
  },
}

const SAFE_SKILL_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/

// 只有 CLI 自己在读取 prompt 时展开 `/<skill>` 的 Agent 才算真实加载 Skill。
// 展开发生在 CLI 层，不经过模型判断，因此是唯一可确定的注入路径。
// 实测（Claude Code 2.1.220，--input-format stream-json）：
//   - `/<skill>` 位于 prompt 开头 → SKILL.md 正文完整进入上下文
//   - 同样的 slash 放在 prompt 末尾、或仅在文中点名 Skill → 完全不加载
//   - 开头连写多个 slash → 只有第一个生效
// 所以一次任务只挂载一个 Skill，并且必须拼在最前面。
export const SLASH_SKILL_AGENTS = new Set(['claude'])
export const MAX_SELECTED_SKILLS = 1

export function parseSkillFrontmatter(content, fallbackName = '') {
  const source = String(content || '')
  const block = source.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/)?.[1] || ''
  const read = (key) => {
    const match = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
    if (!match) return ''
    return match[1].trim().replace(/^(['"])([\s\S]*)\1$/, '$2')
  }
  const name = read('name') || fallbackName
  return {
    id: String(name || fallbackName).trim(),
    name: String(name || fallbackName).trim(),
    description: read('description'),
  }
}

function readSkill(skillFile, fallbackName, io) {
  try {
    const parsed = parseSkillFrontmatter(io.readFileSync(skillFile, 'utf8'), fallbackName)
    if (!SAFE_SKILL_ID.test(parsed.id)) return null
    return { ...parsed, path: skillFile }
  } catch {
    return null
  }
}

function scanRoot(root, io) {
  if (!io.existsSync(root)) return []
  const found = []
  let entries = []
  try {
    entries = io.readdirSync(root, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries.slice(0, 1000)) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    const skillFile = path.join(root, entry.name, 'SKILL.md')
    if (!io.existsSync(skillFile)) continue
    const skill = readSkill(skillFile, entry.name, io)
    if (skill) found.push(skill)
  }
  return found
}

export function discoverInstalledSkills(options = {}) {
  const io = options.io || fs
  const homeDir = options.homeDir || os.homedir()
  const targets = options.targets || AGENT_SKILL_TARGETS
  const merged = new Map()

  for (const [agentId, target] of Object.entries(targets)) {
    for (const relativeRoot of target.roots || []) {
      const root = path.resolve(homeDir, relativeRoot)
      for (const skill of scanRoot(root, io)) {
        const existing = merged.get(skill.id) || {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          installedFor: [],
          locations: [],
          sourceType: 'local',
          provider: 'Local',
        }
        if (!existing.installedFor.includes(agentId)) existing.installedFor.push(agentId)
        existing.locations.push({ agentId, path: skill.path })
        if (!existing.description && skill.description) existing.description = skill.description
        merged.set(skill.id, existing)
      }
    }
  }
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function loadSkillCatalog(filePath, io = fs) {
  const parsed = JSON.parse(io.readFileSync(filePath, 'utf8'))
  if (parsed?.schema !== 1 || !Array.isArray(parsed.skills)) throw new Error('Unsupported skills catalog')
  const seen = new Set()
  return parsed.skills.filter((skill) => {
    if (!SAFE_SKILL_ID.test(skill?.id || '') || seen.has(skill.id)) return false
    seen.add(skill.id)
    return true
  })
}

// `loadable` 表示这个 Skill 能否被确定性加载，即它已经装在支持 slash 展开的
// Agent 目录下。UI 只应让 loadable 的条目可勾选，其余只是「可安装」。
function withLoadable(skill) {
  return {
    ...skill,
    loadable: (skill.installedFor || []).some((agentId) => SLASH_SKILL_AGENTS.has(agentId)),
  }
}

export function mergeSkillCatalog(catalog, installed) {
  const installedById = new Map(installed.map((skill) => [skill.id, skill]))
  const result = catalog.map((entry) =>
    withLoadable({
      ...entry,
      installedFor: installedById.get(entry.id)?.installedFor || [],
      locations: installedById.get(entry.id)?.locations || [],
      installable: true,
    })
  )
  for (const local of installed) {
    if (!result.some((skill) => skill.id === local.id)) {
      result.push(withLoadable({ ...local, installable: false, popular: false }))
    }
  }
  // 本机真正能加载的排在前面，让 `/` 选择器第一屏就是可用项。
  return result.sort((left, right) => Number(right.loadable) - Number(left.loadable) || left.name.localeCompare(right.name))
}

// Skill 按 Agent 生效，不是按整个任务生效：只有支持 slash 展开的 Agent 会真的
// 加载它。所以这里只在「没有任何一个参赛 Agent 能加载」时才判为错误；能加载的
// 那部分照常挂载，不能加载的由 skillTargetSummary 明确告诉用户。
export function selectedSkillIssues(selectedSkillIds, skills, agentIds) {
  const byId = new Map(skills.map((skill) => [skill.id, skill]))
  const issues = []
  if (selectedSkillIds.length > MAX_SELECTED_SKILLS) {
    issues.push(`一次任务最多挂载 ${MAX_SELECTED_SKILLS} 个 Skill，才能保证它被真实加载`)
  }
  const capableAgentIds = agentIds.filter((agentId) => SLASH_SKILL_AGENTS.has(agentId))
  for (const id of selectedSkillIds) {
    const skill = byId.get(id)
    if (!skill) {
      issues.push(`未知 Skill：${id}`)
      continue
    }
    if (!capableAgentIds.length) {
      issues.push(
        `Skill ${id} 无法在所选 Agent 上确定性加载；目前只有 ${[...SLASH_SKILL_AGENTS].join(', ')} 支持`
      )
      continue
    }
    const missing = capableAgentIds.filter((agentId) => !skill.installedFor.includes(agentId))
    if (missing.length) issues.push(`Skill ${id} 尚未安装到：${missing.join(', ')}`)
  }
  return [...new Set(issues)]
}

// 用于把「谁会加载、谁不会」如实回给界面，避免出现假绿灯。
export function skillTargetSummary(selectedSkillIds, agentIds) {
  if (!selectedSkillIds.length) return { loadedBy: [], skippedBy: [] }
  return {
    loadedBy: agentIds.filter((agentId) => SLASH_SKILL_AGENTS.has(agentId)),
    skippedBy: agentIds.filter((agentId) => !SLASH_SKILL_AGENTS.has(agentId)),
  }
}

export function agentLoadsSkills(agentId) {
  return SLASH_SKILL_AGENTS.has(agentId)
}

// 返回值必须拼在最终 prompt 的最前面（见 SLASH_SKILL_AGENTS 上方说明）。
export function buildSelectedSkillsPrefix(selectedSkillIds) {
  const id = selectedSkillIds[0]
  return id ? `/${id}\n\n` : ''
}

export function normalizeDeliveryConstraint(value, fallback, maxLength = 6000) {
  const text = typeof value === 'string' ? value.trim() : ''
  return (text || String(fallback || '').trim()).slice(0, maxLength)
}

export function skillInstallerArgs(entry, agentIds) {
  if (entry?.sourceType !== 'skills-cli' || !entry.source || !entry.skill) return null
  const targets = agentIds.map((id) => AGENT_SKILL_TARGETS[id]?.installerId).filter(Boolean)
  if (!targets.length) throw new Error('没有可安装 Skill 的 Agent')
  return [
    '--yes',
    'skills',
    'add',
    entry.source,
    '--skill',
    entry.skill,
    '--global',
    '--copy',
    '--yes',
    ...targets.flatMap((target) => ['--agent', target]),
  ]
}

export function installBundledSkill(entry, agentIds, options = {}) {
  if (entry?.sourceType !== 'bundled') throw new Error('Not a bundled skill')
  const io = options.io || fs
  const homeDir = options.homeDir || os.homedir()
  const workspaceRoot = options.workspaceRoot
  const source = path.resolve(workspaceRoot, entry.source)
  if (!source.startsWith(`${path.resolve(workspaceRoot)}${path.sep}`) || !io.existsSync(path.join(source, 'SKILL.md'))) {
    throw new Error('Bundled skill source is invalid')
  }
  const installed = []
  for (const agentId of agentIds) {
    const target = AGENT_SKILL_TARGETS[agentId]
    if (!target) continue
    const root = path.resolve(homeDir, target.roots[0])
    const destination = path.join(root, entry.id)
    io.mkdirSync(root, { recursive: true })
    io.cpSync(source, destination, { recursive: true, force: true })
    installed.push({ agentId, path: destination })
  }
  if (!installed.length) throw new Error('没有可安装 Skill 的 Agent')
  return installed
}
