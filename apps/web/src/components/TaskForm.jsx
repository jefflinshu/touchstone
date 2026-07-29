import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Loader2,
  ArrowRight,
  Plus,
  X,
  Check,
  ChevronDown,
  TriangleAlert,
  Sparkles,
  SlidersHorizontal,
  Download,
  FileCode2,
  FileText,
  LockKeyhole,
  Route,
  ShieldCheck,
  Shapes,
  Unplug,
  CopyPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import AgentIcon from './AgentIcon.jsx'
import ProviderManager from './ProviderManager.jsx'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n.jsx'
import {
  readJson,
  readString,
  restoreRunners,
  restoreSelectedSkills,
  writeJson,
  writeString,
} from '@/lib/persistedState'

let uid = 0
const nextRunnerKey = () => ++uid
// 一次任务只挂载一个 Skill。CLI 只会展开 prompt 开头的第一个 `/<skill>`，
// 多挂的部分只能靠模型自觉加载，不能保证生效，所以干脆不给这个选项。
const MAX_SELECTED_SKILLS = 1
// 历史上这两个键没有前缀，保持原样以免用户已保存的交付约束在升级后丢失。
const DELIVERY_STORAGE_KEY = 'touchstone-delivery-constraint'
const DELIVERY_MODE_STORAGE_KEY = 'touchstone-delivery-mode'
const RUNNERS_STORAGE_KEY = 'runners'
const DRAFT_STORAGE_KEY = 'prompt-draft'
const SKILLS_STORAGE_KEY = 'selected-skills'
const SINGLE_HTML_CONSTRAINT =
  '请把最终作品交付为当前工作目录中的一个自包含 index.html。CSS 和 JavaScript 必须内联；小型图片、字体或其他必要资源应尽量使用 data URL 内嵌。不要创建需要构建步骤才能运行的源码项目，不要依赖其他网站、网络 CDN、localhost 服务、密钥或父目录文件。直接双击打开 index.html 时，核心内容与交互必须可用。'
const SINGLE_SVG_CONSTRAINT =
  '请把最终作品交付为当前工作目录中的一个自包含 index.svg。所有样式、渐变、滤镜、图形与必要文字都必须写在这个 SVG 文件内；不要引用外部图片、字体、脚本、网络 CDN、localhost 服务、密钥或父目录文件。SVG 必须包含 title 和 desc，并且直接双击打开 index.svg 时即可完整查看。'
const SINGLE_MARKDOWN_CONSTRAINT =
  '请把最终方案交付为当前工作目录中的一个自包含 plan.md，只创建这一份最终产物。使用标准 Markdown/GFM，不依赖外部图片、网络链接中的内容、localhost 服务、密钥或父目录文件。为了便于比较不同 Agent 的方案，请明确写出：目标与假设、方案摘要、关键决策、执行步骤、风险与取舍、验收标准。直接打开 plan.md 时应能完整阅读。'
const STATIC_FOLDER_CONSTRAINT =
  '请在当前工作目录生成最终静态作品。必须包含一个可以直接在浏览器中打开运行的 HTML 入口，优先命名为 index.html。所有资源必须位于当前目录内并使用相对路径，不要依赖网络 CDN、localhost 服务、密钥或父目录文件。'

function initialDeliveryConstraint() {
  return readString(DELIVERY_STORAGE_KEY, '', { raw: true }) || SINGLE_HTML_CONSTRAINT
}

function initialDeliveryMode() {
  return readString(DELIVERY_MODE_STORAGE_KEY, '', { raw: true }) || 'single-html'
}

function ModelPicker({ agent, provider, catalog, value, onChange }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const selectedHealth = provider ? null : agent.health?.modelHealth?.[value]
  const models = provider?.models || agent.models || []
  const metadata = new Map((catalog?.models || []).map((model) => [model.id, model]))
  const normalizedQuery = query.trim().toLowerCase()
  const visibleModels = normalizedQuery
    ? models.filter((id) => {
        const model = metadata.get(id)
        return id.toLowerCase().includes(normalizedQuery) || model?.name?.toLowerCase().includes(normalizedQuery)
      })
    : models
  const exactModel = models.find((id) => id.toLowerCase() === normalizedQuery)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-full max-w-[180px] cursor-pointer items-center gap-1 border-l border-white/10 px-2 font-mono text-[11px] whitespace-nowrap text-white/55 outline-none transition-colors hover:text-white"
        >
          <span className={cn('truncate', selectedHealth?.available === false && 'text-amber-400')}>{value || 'auto'}</span>
          {selectedHealth?.available === false && <TriangleAlert className="h-3 w-3 shrink-0 text-amber-400" />}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[360px] w-[min(320px,calc(100vw-32px))] overflow-y-auto font-mono text-[11px]">
        {provider && (
          <div
            className="sticky top-0 z-10 flex gap-1.5 border-b border-white/8 bg-[#0c0c0f] p-1.5"
            onKeyDown={(event) => event.stopPropagation()}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search or enter provider/model"
              className="h-7 min-w-0 flex-1 rounded border border-white/12 bg-white/[0.03] px-2 text-[10px] text-white outline-none placeholder:text-white/20 focus:border-sky-300/45"
              spellCheck={false}
            />
            <button
              type="button"
              disabled={!query.trim()}
              onClick={() => {
                onChange(exactModel || query.trim())
                setQuery('')
              }}
              className="rounded bg-sky-300 px-2 text-[9px] font-semibold text-black disabled:opacity-35"
            >
              {exactModel ? 'SELECT' : 'USE'}
            </button>
          </div>
        )}
        {visibleModels.map((m) => {
          const modelHealth = agent.health?.modelHealth?.[m]
          const model = metadata.get(m)
          return (
          <DropdownMenuItem key={m} onSelect={() => onChange(m)} title={modelHealth?.fix || undefined}>
            <AgentIcon agentId={agent.id} color={agent.color} className="h-3 w-3" />
            <span className={cn('min-w-0 flex-1', modelHealth?.available === false && 'text-amber-400')}>
              <span className="block truncate">{model?.name || m}</span>
              {model?.name && model.name !== m && (
                <span className="block truncate text-[8px] text-white/25">{m}</span>
              )}
            </span>
            {model?.reasoning && <span className="text-[8px] text-violet-300/50">R</span>}
            {model?.toolCall && <span className="text-[8px] text-emerald-300/50">T</span>}
            {modelHealth?.available === false && <TriangleAlert className="ml-auto h-3 w-3 text-amber-400" />}
          </DropdownMenuItem>
          )
        })}
        {provider && visibleModels.length === 0 && (
          <div className="px-2 py-3 text-center text-[10px] text-white/30">{t('provider.noModelMatch')}</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProviderPicker({ providers, value, onChange }) {
  const { t } = useI18n()
  const selected = providers.find((provider) => provider.id === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-full max-w-[145px] items-center gap-1.5 border-l border-white/10 px-2 font-mono text-[9px] outline-none transition-colors',
            selected ? 'text-sky-200' : 'text-white/35 hover:text-white/65'
          )}
        >
          {selected ? <Route className="h-3 w-3 shrink-0" /> : null}
          <span className="truncate">{selected?.name || t('provider.claudeAccount')}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-45" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px] font-mono text-[10px]">
        <DropdownMenuItem onSelect={() => onChange('')}>
          <AgentIcon agentId="claude" className="h-3 w-3" />
          {t('provider.claudeAccount')}
        </DropdownMenuItem>
        {providers.map((provider) => (
          <DropdownMenuItem key={provider.id} onSelect={() => onChange(provider.id)}>
            {provider.catalogProviderId ? (
              <img
                src={`https://models.dev/logos/${provider.catalogProviderId}.svg`}
                alt=""
                className="h-3 w-3 object-contain text-sky-300"
              />
            ) : (
              <Route className="h-3 w-3 text-sky-300" />
            )}
            <span className="min-w-0 flex-1 truncate">{provider.name}</span>
            <span className="text-[8px] text-white/25">{provider.models.length}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// CLI 未就绪：点击警告图标弹出配置引导（不再常驻展示）
function HealthHint({ agent }) {
  const { t } = useI18n()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={t('task.needsConfigTitle')}
          className="flex h-full cursor-pointer items-center text-amber-400/90 outline-none transition-colors hover:text-amber-300"
        >
          <TriangleAlert className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px] p-3">
        <p className="font-mono text-[10px] font-bold tracking-[0.18em] text-amber-400 uppercase">
          {t('task.needsConfig', { name: agent.name })}
        </p>
        <p className="mt-2 text-xs leading-5 text-white/75">{agent.health?.fix}</p>
        <p className="mt-1.5 text-[11px] leading-5 text-white/40">{t('task.refreshAfterConfig')}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RunnerStatus({ runner, user, onLogin }) {
  const { t } = useI18n()
  const online = Boolean(runner?.online)
  const available = Boolean(runner?.canExecute)
  const status = available
    ? t('runner.ready')
    : online
      ? t('runner.viewOnly')
      : t('runner.offlineShort')
  const detail = available
    ? t('runner.readyHelp')
    : online
      ? t('runner.viewOnlyHelp')
      : t('runner.offlineHelp')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[10px] tracking-[0.08em] outline-none transition-colors',
            available
              ? 'border-emerald-300/25 text-emerald-200 hover:border-emerald-300/45'
              : online
                ? 'border-amber-300/25 text-amber-200 hover:border-amber-300/45'
                : 'border-red-300/20 text-red-200 hover:border-red-300/40'
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              available ? 'bg-emerald-300' : online ? 'bg-amber-300' : 'bg-red-300'
            )}
          />
          <span>{status}</span>
          <ChevronDown className="h-3 w-3 text-white/35" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[min(320px,calc(100vw-32px))] p-3">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
              available
                ? 'border-emerald-300/25 bg-emerald-300/[0.06] text-emerald-300'
                : online
                  ? 'border-amber-300/25 bg-amber-300/[0.06] text-amber-300'
                  : 'border-red-300/20 bg-red-300/[0.05] text-red-300'
            )}
          >
            {available ? <ShieldCheck className="h-3.5 w-3.5" /> : <Unplug className="h-3.5 w-3.5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-xs font-semibold text-white/85">{runner?.label || 'Owner Mac'}</p>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 font-mono text-[8px] uppercase',
                  online
                    ? 'bg-emerald-300/10 text-emerald-200'
                    : 'bg-red-300/10 text-red-200'
                )}
              >
                {online ? t('runner.online') : t('runner.offlineShort')}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-white/55">{detail}</p>
          </div>
        </div>
        {!user && online && (
          <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={onLogin}>
            {t('nav.signIn')}
          </Button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function TaskForm({
  agents,
  runner,
  onSubmit,
  user,
  onLogin,
  activeRuns = 0,
  queuedRuns = 0,
  maxConcurrentRuns = 0,
}) {
  const { t } = useI18n()
  // 草稿写在本机：误刷新或切页面不该丢掉正在写的 prompt。
  const [prompt, setPrompt] = useState(() => readString(DRAFT_STORAGE_KEY, ''))
  const [runners, setRunners] = useState([])
  const [publish, setPublish] = useState(false)
  const [skills, setSkills] = useState([])
  const [skillsInstallEnabled, setSkillsInstallEnabled] = useState(false)
  const [selectedSkills, setSelectedSkills] = useState([])
  const [installingSkill, setInstallingSkill] = useState('')
  const [skillsError, setSkillsError] = useState('')
  // 输入框里打 `/` 时唤出的 Skill 选择器
  const [slashMenu, setSlashMenu] = useState({ open: false, query: '' })
  const promptRef = useRef(null)
  const [providers, setProviders] = useState([])
  const [providersLoaded, setProvidersLoaded] = useState(false)
  const [modelCatalogs, setModelCatalogs] = useState({})
  const [showDelivery, setShowDelivery] = useState(false)
  const [deliveryPreset, setDeliveryPreset] = useState(initialDeliveryMode)
  const [deliveryConstraint, setDeliveryConstraint] = useState(initialDeliveryConstraint)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 首次拿到 agents/providers 后恢复上次的参赛者配置；没有存档时才回落到
  // 「每个就绪的 CLI 各一个」。未就绪的（例如未登录的 Gemini）不自动入选，
  // 但仍留在下拉里可手动添加。
  const restoredRunners = useRef(false)
  // 在下面的回写 effect 之前声明，避免读到暂存死区。
  const restoredSkills = useRef(false)
  useEffect(() => {
    if (restoredRunners.current || !agents.length) return
    // Provider 还在路上时先等一拍，否则存档里的 Provider 会被误判为已删除。
    if (user && !providersLoaded) return
    restoredRunners.current = true

    const stored = restoreRunners(readJson(RUNNERS_STORAGE_KEY, []), {
      agents,
      providers,
      nextKey: nextRunnerKey,
    })
    if (stored.length) {
      setRunners(stored)
      return
    }
    const readyAgents = agents.filter((agent) => agent.health?.ready)
    if (!readyAgents.length) return
    setRunners(readyAgents.map((a) => ({
      key: nextRunnerKey(),
      agentId: a.id,
      model: a.models?.[0] || '',
      providerId: '',
      strictModel: true,
    })))
  }, [agents, providers, providersLoaded, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // 存档只保留可复原的字段，key 是运行时序号，不写进去。
  useEffect(() => {
    if (!restoredRunners.current) return
    writeJson(
      RUNNERS_STORAGE_KEY,
      runners.map(({ agentId, model, providerId, strictModel }) => ({ agentId, model, providerId, strictModel }))
    )
  }, [runners])

  useEffect(() => {
    writeString(DRAFT_STORAGE_KEY, prompt)
  }, [prompt])

  useEffect(() => {
    // 恢复完成前不要回写，否则初始的空数组会覆盖掉存档。
    if (!restoredSkills.current) return
    writeJson(SKILLS_STORAGE_KEY, selectedSkills)
  }, [selectedSkills])

  const agentOf = (id) => agents.find((a) => a.id === id)
  const targetAgentIds = [...new Set(runners.map((runner) => runner.agentId))]

  async function refreshSkills(nextSkills = null) {
    if (nextSkills) {
      setSkills(nextSkills)
      return
    }
    // 本机已装的 Skill 是只读信息，未登录也能浏览。
    try {
      const response = await fetch('/api/skills')
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'failed')
      setSkills(data.skills || [])
      setSkillsInstallEnabled(Boolean(data.installEnabled))
      setSkillsError('')
    } catch (err) {
      setSkillsError(err.message)
    }
  }

  useEffect(() => {
    refreshSkills()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) {
      setProviders([])
      // 未登录时没有 Provider 可拉，直接算加载完成，否则恢复逻辑会一直等。
      setProvidersLoaded(true)
      return
    }
    fetch('/api/providers')
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'failed')
        return data
      })
      .then((data) => setProviders(data.providers || []))
      .catch(() => setProviders([]))
      .finally(() => setProvidersLoaded(true))
  }, [user])

  useEffect(() => {
    const providerIds = [...new Set(providers.map((provider) => provider.catalogProviderId).filter(Boolean))]
    for (const providerId of providerIds) {
      if (modelCatalogs[providerId]) continue
      fetch(`/api/model-catalog?provider=${encodeURIComponent(providerId)}`)
        .then(async (response) => {
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(data.error || 'failed')
          return data.catalog
        })
        .then((catalog) => setModelCatalogs((current) => ({ ...current, [providerId]: catalog })))
        .catch(() => setModelCatalogs((current) => ({ ...current, [providerId]: { models: [] } })))
    }
  }, [providers, modelCatalogs])

  useEffect(() => {
    try {
      writeString(DELIVERY_STORAGE_KEY, deliveryConstraint, { raw: true })
      writeString(DELIVERY_MODE_STORAGE_KEY, deliveryPreset, { raw: true })
    } catch {}
  }, [deliveryConstraint, deliveryPreset])

  // Skill 按 Agent 生效：只有支持 slash 展开的 Agent 会真的加载它。
  // 只要有一个这样的 Agent 参赛就允许挂载，其余 Agent 会跳过（明确告知用户）。
  const skillCapableAgentIds = useMemo(
    () => targetAgentIds.filter((agentId) => agentOf(agentId)?.slashSkills),
    [agents, runners] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const skillsUsable = skillCapableAgentIds.length > 0
  const skillSkippedAgents = useMemo(
    () => targetAgentIds.filter((agentId) => !agentOf(agentId)?.slashSkills).map((agentId) => agentOf(agentId)?.name || agentId),
    [agents, runners] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Skill 列表和参赛者都就位后，先恢复上次挂载的 Skill，之后每次变化都重新校验。
  // 两者都要等：Skill 列表先到而 runners 还没恢复时，capableAgentIds 是空的，
  // 会把存档里本来合法的 Skill 判成失效并清掉。
  useEffect(() => {
    if (!skills.length || !runners.length) return
    const validate = (ids) =>
      restoreSelectedSkills(ids, {
        skills,
        capableAgentIds: skillCapableAgentIds,
        max: MAX_SELECTED_SKILLS,
      })
    if (!restoredSkills.current) {
      restoredSkills.current = true
      const stored = readJson(SKILLS_STORAGE_KEY, [])
      setSelectedSkills((current) => validate(current.length ? current : stored))
      return
    }
    setSelectedSkills(validate)
  }, [skills, runners, skillsUsable]) // eslint-disable-line react-hooks/exhaustive-deps

  async function installSkill(skill) {
    if (!user) {
      onLogin?.()
      return
    }
    if (!skillsInstallEnabled) {
      setSkillsError(t('task.skillsInstallLocalOnly'))
      return
    }
    if (!targetAgentIds.length) {
      setSkillsError(t('task.skillsChooseAgent'))
      return
    }
    setInstallingSkill(skill.id)
    setSkillsError('')
    try {
      const response = await fetch('/api/skills/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: skill.id, agentIds: targetAgentIds }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'failed')
      await refreshSkills(data.skills || [])
      setSelectedSkills((current) => [...new Set([...current, skill.id])])
    } catch (err) {
      setSkillsError(err.message)
    } finally {
      setInstallingSkill('')
    }
  }

  // 只列出真正能被加载的 Skill：已装在支持 slash 展开的 Agent 上，
  // 且当前所有参赛 Agent 都装了它。
  const availableSkills = useMemo(
    () =>
      skills.filter(
        (skill) =>
          skill.loadable &&
          skillCapableAgentIds.length > 0 &&
          skillCapableAgentIds.every((agentId) => skill.installedFor?.includes(agentId))
      ),
    [skills, runners] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const slashMatches = useMemo(() => {
    if (!slashMenu.open) return []
    const query = slashMenu.query.trim().toLowerCase()
    const pool = skillsUsable ? availableSkills : []
    if (!query) return pool.slice(0, 8)
    return pool
      .filter((skill) => skill.id.toLowerCase().includes(query) || skill.name?.toLowerCase().includes(query))
      .slice(0, 8)
  }, [slashMenu, availableSkills, skillsUsable])

  // 行首（或空白后）的 `/` 才唤出选择器，避免误伤正文里的斜杠和路径。
  function syncSlashMenu(value, caret) {
    const upToCaret = value.slice(0, caret)
    const match = upToCaret.match(/(?:^|\s)\/([a-z0-9._-]*)$/i)
    setSlashMenu(match ? { open: true, query: match[1] } : { open: false, query: '' })
  }

  function pickSkill(skill) {
    setSelectedSkills([skill.id])
    setSkillsError('')
    setSlashMenu({ open: false, query: '' })
    // 把触发用的 `/xxx` 从正文里删掉——真正的 slash 由服务端拼到 prompt 最前面。
    setPrompt((current) => current.replace(/(?:^|\s)\/[a-z0-9._-]*$/i, (matched) => (matched.startsWith('/') ? '' : ' ')))
    promptRef.current?.focus()
  }

  function chooseDeliveryPreset(preset) {
    setDeliveryPreset(preset)
    if (preset === 'single-html') setDeliveryConstraint(SINGLE_HTML_CONSTRAINT)
    if (preset === 'single-svg') setDeliveryConstraint(SINGLE_SVG_CONSTRAINT)
    if (preset === 'single-markdown') setDeliveryConstraint(SINGLE_MARKDOWN_CONSTRAINT)
    if (preset === 'static-folder') setDeliveryConstraint(STATIC_FOLDER_CONSTRAINT)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!runner?.canExecute) {
      setError(runner?.online ? t('runner.errorNotPaired') : t('runner.errorOffline'))
      if (!user && runner?.online) onLogin?.()
      return
    }
    if (!prompt.trim()) {
      setError(t('task.errorPrompt'))
      return
    }
    if (runners.length === 0) {
      setError(t('task.errorAgent'))
      return
    }
    if (!user) {
      setError(t('task.errorLogin'))
      onLogin?.()
      return
    }
    const unavailable = runners
      .map((runner) => {
        const agent = agentOf(runner.agentId)
        if (!agent) return `Unknown agent: ${runner.agentId}`
        const provider = providers.find((item) => item.id === runner.providerId)
        if (runner.providerId && !provider) return t('provider.errorMissing')
        if (provider) {
          if (agent.id !== 'claude') return t('provider.errorClaudeOnly')
          if (!agent.health?.installed || !agent.health?.compatible) return agent.health?.fix
          if (!runner.model.trim()) return t('provider.errorModel')
          return null
        }
        if (agent.health?.ready === false) return agent.health.fix
        return agent.health?.modelHealth?.[runner.model]?.available === false
          ? agent.health.modelHealth[runner.model].fix
          : null
      })
      .filter(Boolean)
    if (unavailable.length) {
      setError(unavailable.join('；'))
      return
    }
    setBusy(true)
    try {
      await onSubmit({
        prompt: prompt.trim(),
        runners: runners.map(({ agentId, model, providerId, strictModel }) => ({
          agentId,
          model: model.trim(),
          providerId: providerId || null,
          strictModel,
        })),
        publish,
        selectedSkills,
        deliveryMode: deliveryPreset,
        deliveryConstraint: deliveryConstraint.trim(),
      })
      setPrompt('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 rounded-xl border border-white/12 bg-white/[0.02] shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
      <div className="flex min-h-[180px] flex-col p-4 sm:p-5">
        <div className="relative">
          <Textarea
            ref={promptRef}
            rows={3}
            className="min-h-[88px] resize-none border-0 bg-transparent px-2 py-2 text-[15px] leading-7 placeholder:text-white/35 focus:bg-transparent"
            placeholder={t('task.placeholder')}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              syncSlashMenu(e.target.value, e.target.selectionStart ?? e.target.value.length)
            }}
            onKeyDown={(event) => {
              if (!slashMenu.open) return
              if (event.key === 'Escape') {
                event.preventDefault()
                setSlashMenu({ open: false, query: '' })
              }
              if (event.key === 'Enter' && slashMatches.length) {
                event.preventDefault()
                pickSkill(slashMatches[0])
              }
            }}
            onBlur={() => setSlashMenu({ open: false, query: '' })}
          />

          {/* 往下展开并限高：composer 靠近页面顶部，向上弹会溢出到视口外 */}
          {slashMenu.open && (
            <div className="absolute top-full left-1 z-30 mt-1 max-h-[280px] w-[min(420px,calc(100vw-48px))] overflow-y-auto rounded-lg border border-white/12 bg-[#0c0c0f] shadow-2xl">
              <p className="border-b border-white/8 px-2.5 py-1.5 font-mono text-[9px] tracking-[0.14em] text-white/40 uppercase">
                {t('task.skillsSlashHint')}
              </p>
              {slashMatches.map((skill, index) => (
                <button
                  key={skill.id}
                  type="button"
                  // Textarea 的 blur 会先于 click 触发，用 mousedown 才点得中。
                  onMouseDown={(event) => {
                    event.preventDefault()
                    pickSkill(skill)
                  }}
                  className={cn(
                    'flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]',
                    index === 0 && 'bg-white/[0.03]'
                  )}
                >
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[11px] text-white/85">/{skill.id}</span>
                    {skill.description && (
                      <span className="mt-0.5 block truncate text-[10px] leading-4 text-white/40">
                        {skill.description}
                      </span>
                    )}
                  </span>
                </button>
              ))}
              {slashMatches.length === 0 && (
                <p className="px-2.5 py-3 text-center text-[10px] text-white/35">
                  {skillsUsable ? t('task.skillsNone') : t('task.skillsClaudeOnly')}
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="mx-2 mt-1 font-mono text-[11px] text-red-400" role="alert">
            {error}
          </p>
        )}

        {selectedSkills.length > 0 && (
          <div className="mx-1 mt-2 flex flex-wrap items-center gap-1.5">
            {selectedSkills.map((id) => (
              <span
                key={id}
                className="flex h-6 items-center gap-1 rounded-md border border-violet-300/30 bg-violet-400/10 pr-1 pl-2 font-mono text-[10px] text-violet-200"
              >
                <Sparkles className="h-3 w-3" />
                /{id}
                <button
                  type="button"
                  onClick={() => setSelectedSkills([])}
                  className="rounded p-0.5 text-violet-200/60 transition-colors hover:text-violet-100"
                  aria-label={`${t('task.skillsRemove')} ${id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {skillSkippedAgents.length > 0 && (
              <span className="text-[10px] text-white/40">
                {t('task.skillsSkippedBy', { agents: skillSkippedAgents.join(', ') })}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-3 border-t border-white/8 pt-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {runners.map((r) => {
            const a = agentOf(r.agentId)
            if (!a) return null
            const provider = providers.find((item) => item.id === r.providerId)
            const modelHealth = a.health?.modelHealth?.[r.model]
            const ready = provider
              ? a.health?.installed !== false && a.health?.compatible !== false && Boolean(r.model)
              : a.health?.ready !== false && modelHealth?.available !== false
            const healthAgent =
              modelHealth?.available === false ? { ...a, health: { ...a.health, fix: modelHealth.fix } } : a
            return (
              <div
                key={r.key}
                className="flex h-8 items-center overflow-hidden rounded-md border border-white/15 bg-white/[0.04]"
              >
                <span
                  title={a.name}
                  className="flex h-full shrink-0 items-center gap-1.5 pl-2.5 text-xs font-medium whitespace-nowrap"
                >
                  <AgentIcon agentId={a.id} color={a.color} className="h-3.5 w-3.5" />
                  {/* 图标已标识 CLI，名称去掉 Code/CLI 后缀更紧凑 */}
                  {a.name.replace(/\s+(Code|CLI)$/i, '')}
                  {!ready && <HealthHint agent={healthAgent} />}
                </span>
                {a.id === 'claude' && (
                  <ProviderPicker
                    providers={providers}
                    value={r.providerId}
                    onChange={(providerId) => {
                      const nextProvider = providers.find((item) => item.id === providerId)
                      setRunners((current) =>
                        current.map((item) =>
                          item.key === r.key
                            ? {
                                ...item,
                                providerId,
                                model: nextProvider?.models?.[0] || (providerId ? '' : a.models?.[0] || ''),
                              }
                            : item
                        )
                      )
                    }}
                  />
                )}
                <ModelPicker
                  agent={a}
                  provider={provider}
                  catalog={provider?.catalogProviderId ? modelCatalogs[provider.catalogProviderId] : null}
                  value={r.model}
                  onChange={(v) => setRunners((rs) => rs.map((x) => (x.key === r.key ? { ...x, model: v } : x)))}
                />
                {provider && (
                  <button
                    type="button"
                    title={r.strictModel ? t('provider.strictOn') : t('provider.strictOff')}
                    onClick={() =>
                      setRunners((current) =>
                        current.map((item) => item.key === r.key ? { ...item, strictModel: !item.strictModel } : item)
                      )
                    }
                    className={cn(
                      'flex h-full items-center border-l border-white/10 px-1.5 transition-colors',
                      r.strictModel ? 'text-emerald-300' : 'text-amber-300/60'
                    )}
                  >
                    {r.strictModel ? <LockKeyhole className="h-3 w-3" /> : <Route className="h-3 w-3" />}
                  </button>
                )}
                {/* 复制出一个同 CLI、同模型、同 Provider 的参赛者：
                    每个 run 都是独立会话，用来看同一模型跑同一题的稳定性。 */}
                <button
                  type="button"
                  title={t('task.duplicateRunner')}
                  aria-label={t('task.duplicateRunner')}
                  className="flex h-full cursor-pointer items-center border-l border-white/10 px-1.5 text-white/30 transition-colors hover:text-white"
                  onClick={() =>
                    setRunners((rs) => {
                      const index = rs.findIndex((x) => x.key === r.key)
                      const copy = { ...r, key: nextRunnerKey() }
                      return [...rs.slice(0, index + 1), copy, ...rs.slice(index + 1)]
                    })
                  }
                >
                  <CopyPlus className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  title={t('task.removeRunner')}
                  aria-label={t('task.removeRunner')}
                  className="flex h-full cursor-pointer items-center px-1.5 text-white/30 transition-colors hover:text-red-400"
                  onClick={() => setRunners((rs) => rs.filter((x) => x.key !== r.key))}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" title={t('task.addRunner')} className="h-8 w-8 p-0">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              {agents.map((a) => (
                <DropdownMenuItem
                  key={a.id}
                  onSelect={() =>
                    setRunners((rs) => [...rs, {
                      key: ++uid,
                      agentId: a.id,
                      model: a.models?.[0] || '',
                      providerId: '',
                      strictModel: true,
                    }])
                  }
                >
                  <AgentIcon agentId={a.id} color={a.color} className="h-3.5 w-3.5" />
                  {a.name}
                  {a.health?.ready === false && <TriangleAlert className="ml-auto h-3 w-3 text-amber-400" />}
                </DropdownMenuItem>
              ))}
              {agents.length === 0 && (
                <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-white/55">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      runner?.online ? 'bg-amber-300' : 'bg-red-300'
                    )}
                  />
                  {t('task.noAgents')}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 并发是全局的：连续下发多批时，超出上限的会排队而不是立即开跑。
              这里把闸门状态显示出来，免得用户以为任务卡住了。 */}
          {activeRuns > 0 && (
            <span className="flex items-center gap-1.5 font-mono text-[10px] whitespace-nowrap text-white/45">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-acid" />
              {t('task.queueRunning', { count: activeRuns - queuedRuns })}
              {queuedRuns > 0 && (
                <span className="text-amber-300/80">· {t('task.queueWaiting', { count: queuedRuns })}</span>
              )}
              {maxConcurrentRuns > 0 && (
                <span className="text-white/25">· {t('task.queueLimit', { max: maxConcurrentRuns })}</span>
              )}
            </span>
          )}
          </div>

          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={t('task.settings')}
                  aria-label={t('task.settings')}
                  className="h-9 w-9 rounded-md"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={-18}
                className="w-[min(420px,calc(100vw-24px))] rounded-xl p-3 shadow-2xl sm:-translate-x-40"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <section>
                  <p className="px-1 font-mono text-[9px] tracking-[0.16em] text-white/45 uppercase">
                    {t('task.artifactType')}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      ['single-html', FileCode2, 'HTML'],
                      ['single-svg', Shapes, 'SVG'],
                      ['single-markdown', FileText, 'Markdown'],
                    ].map(([value, Icon, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => chooseDeliveryPreset(value)}
                        className={cn(
                          'flex h-9 items-center justify-center gap-1.5 rounded-md border text-[11px] font-medium transition-colors',
                          deliveryPreset === value
                            ? 'border-acid bg-acid/10 text-acid'
                            : 'border-white/12 text-white/55 hover:border-white/30 hover:text-white'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="mt-4">
                  <p className="px-1 font-mono text-[9px] tracking-[0.16em] text-white/45 uppercase">
                    {t('task.settingsModelsSkills')}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <ProviderManager
                      providers={providers}
                      onChange={setProviders}
                      user={user}
                      onLogin={onLogin}
                      runner={runner}
                      className="w-full justify-start"
                    />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 justify-start gap-1.5 font-mono text-[10px] tracking-[0.08em] uppercase"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                          {t('task.skills')}
                          {selectedSkills.length > 0 && (
                            <span className="ml-auto rounded-full bg-violet-400/15 px-1.5 text-violet-200">
                              {selectedSkills.length}
                            </span>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="max-h-[360px] w-[min(360px,calc(100vw-32px))] overflow-y-auto p-1.5"
                      >
                        {!skillsUsable && targetAgentIds.length > 0 && (
                          <p className="border-b border-white/8 px-2 py-2 text-[10px] leading-4 text-amber-300">
                            {t('task.skillsClaudeOnly')}
                          </p>
                        )}
                        {skills.map((skill) => {
                          const installedForAll =
                            targetAgentIds.length > 0 &&
                            targetAgentIds.every((agentId) => skill.installedFor?.includes(agentId))
                          // 只要求能加载它的 Agent 装了它。
                          const installedForCapable =
                            skillCapableAgentIds.length > 0 &&
                            skillCapableAgentIds.every((agentId) => skill.installedFor?.includes(agentId))
                          const selectable = installedForCapable && skill.loadable
                          const selected = selectedSkills.includes(skill.id)
                          const installing = installingSkill === skill.id
                          return (
                            <DropdownMenuItem
                              key={skill.id}
                              onSelect={(event) => {
                                event.preventDefault()
                                if (selectable) {
                                  // 单选：再点一次取消，点别的直接替换。
                                  setSelectedSkills(selected ? [] : [skill.id])
                                } else if (skill.installable) {
                                  installSkill(skill)
                                }
                              }}
                              className="py-2"
                            >
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                                {installing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />
                                ) : selectable ? (
                                  <span
                                    className={cn(
                                      'flex h-3.5 w-3.5 items-center justify-center rounded-full border',
                                      selected
                                        ? 'border-violet-300 bg-violet-300 text-black'
                                        : 'border-white/25'
                                    )}
                                  >
                                    {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                                  </span>
                                ) : (
                                  <Download className="h-3.5 w-3.5 text-white/35" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-xs">{skill.name}</span>
                              {!installedForAll && (
                                <span className="font-mono text-[8px] text-white/35 uppercase">
                                  {t('task.install')}
                                </span>
                              )}
                            </DropdownMenuItem>
                          )
                        })}
                        {skills.length === 0 && (
                          <p className="px-2 py-4 text-center text-xs text-white/35">
                            {skillsError || t('task.skillsNone')}
                          </p>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {skillsError && skills.length > 0 && (
                    <p className="mt-1.5 px-1 text-[10px] text-amber-300">{skillsError}</p>
                  )}
                </section>

                <section className="mt-3 space-y-1 border-t border-white/8 pt-3">
                  <label className="flex h-9 cursor-pointer items-center justify-between rounded-md px-1.5 select-none">
                    <span className="text-xs font-medium text-white/75">{t('task.publish')}</span>
                    <input
                      type="checkbox"
                      checked={publish}
                      onChange={(event) => setPublish(event.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        'relative h-5 w-9 rounded-full border transition-colors',
                        publish ? 'border-acid bg-acid' : 'border-white/15 bg-white/10'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
                          publish ? 'translate-x-[17px] bg-black' : 'translate-x-0.5'
                        )}
                      />
                    </span>
                  </label>

                  <div className="flex min-h-9 items-center justify-between gap-3 rounded-md px-1.5">
                    <span className="text-xs font-medium text-white/75">{t('runner.label')}</span>
                    <RunnerStatus runner={runner} user={user} onLogin={onLogin} />
                  </div>
                </section>

                <section className="mt-3 border-t border-white/8 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDelivery((value) => !value)}
                    className="flex h-9 w-full items-center gap-2 rounded-md px-1.5 text-left text-xs font-medium text-white/65 transition-colors hover:bg-white/8 hover:text-white"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {t('task.deliveryAdvanced')}
                    <ChevronDown
                      className={cn('ml-auto h-3.5 w-3.5 transition-transform', showDelivery && 'rotate-180')}
                    />
                  </button>

                  {showDelivery && (
                    <div className="pt-2">
                      <div className="mb-2 flex gap-1.5">
                        {[
                          ['static-folder', t('task.deliveryStaticFolder')],
                          ['custom', t('task.deliveryCustom')],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => chooseDeliveryPreset(value)}
                            className={cn(
                              'rounded-full border px-2.5 py-1 font-mono text-[9px] tracking-wide',
                              deliveryPreset === value
                                ? 'border-acid bg-acid text-black'
                                : 'border-white/12 text-white/45 hover:border-white/30 hover:text-white'
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        rows={4}
                        maxLength={6000}
                        value={deliveryConstraint}
                        onChange={(event) => {
                          setDeliveryConstraint(event.target.value)
                          setDeliveryPreset('custom')
                        }}
                        className="min-h-24 font-mono text-[10px] leading-5"
                      />
                    </div>
                  )}
                </section>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              disabled={busy || !runner?.canExecute}
              className="h-9 px-4 font-mono text-[11px] font-bold tracking-[0.12em] uppercase"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? t('task.naming') : t('task.run')}
              {!busy && <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
