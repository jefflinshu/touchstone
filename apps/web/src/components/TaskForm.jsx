import { useState, useEffect } from 'react'
import {
  Loader2,
  ArrowRight,
  Plus,
  X,
  Check,
  ChevronDown,
  TriangleAlert,
  CircleHelp,
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
  Zap,
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

let uid = 0
const DELIVERY_STORAGE_KEY = 'touchstone-delivery-constraint'
const DELIVERY_MODE_STORAGE_KEY = 'touchstone-delivery-mode'
const SINGLE_HTML_CONSTRAINT =
  '请把最终作品交付为当前工作目录中的一个自包含 index.html。CSS 和 JavaScript 必须内联；小型图片、字体或其他必要资源应尽量使用 data URL 内嵌。不要创建需要构建步骤才能运行的源码项目，不要依赖其他网站、网络 CDN、localhost 服务、密钥或父目录文件。直接双击打开 index.html 时，核心内容与交互必须可用。'
const SINGLE_SVG_CONSTRAINT =
  '请把最终作品交付为当前工作目录中的一个自包含 index.svg。所有样式、渐变、滤镜、图形与必要文字都必须写在这个 SVG 文件内；不要引用外部图片、字体、脚本、网络 CDN、localhost 服务、密钥或父目录文件。SVG 必须包含 title 和 desc，并且直接双击打开 index.svg 时即可完整查看。'
const SINGLE_MARKDOWN_CONSTRAINT =
  '请把最终方案交付为当前工作目录中的一个自包含 plan.md，只创建这一份最终产物。使用标准 Markdown/GFM，不依赖外部图片、网络链接中的内容、localhost 服务、密钥或父目录文件。为了便于比较不同 Agent 的方案，请明确写出：目标与假设、方案摘要、关键决策、执行步骤、风险与取舍、验收标准。直接打开 plan.md 时应能完整阅读。'
const STATIC_FOLDER_CONSTRAINT =
  '请在当前工作目录生成最终静态作品。必须包含一个可以直接在浏览器中打开运行的 HTML 入口，优先命名为 index.html。所有资源必须位于当前目录内并使用相对路径，不要依赖网络 CDN、localhost 服务、密钥或父目录文件。'

function initialDeliveryConstraint() {
  try {
    return localStorage.getItem(DELIVERY_STORAGE_KEY) || SINGLE_HTML_CONSTRAINT
  } catch {
    return SINGLE_HTML_CONSTRAINT
  }
}

function initialDeliveryMode() {
  try {
    return localStorage.getItem(DELIVERY_MODE_STORAGE_KEY) || 'single-html'
  } catch {
    return 'single-html'
  }
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
          <span className="uppercase">{t('runner.label')}</span>
          <span className="text-white/30">·</span>
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

export default function TaskForm({ agents, runner, onSubmit, user, onLogin }) {
  const { t } = useI18n()
  const [prompt, setPrompt] = useState('')
  const [runners, setRunners] = useState([])
  const [publish, setPublish] = useState(false)
  const [skills, setSkills] = useState([])
  const [skillsInstallEnabled, setSkillsInstallEnabled] = useState(false)
  const [selectedSkills, setSelectedSkills] = useState([])
  const [installingSkill, setInstallingSkill] = useState('')
  const [skillsError, setSkillsError] = useState('')
  const [providers, setProviders] = useState([])
  const [modelCatalogs, setModelCatalogs] = useState({})
  const [showDelivery, setShowDelivery] = useState(false)
  const [deliveryPreset, setDeliveryPreset] = useState(initialDeliveryMode)
  const [deliveryConstraint, setDeliveryConstraint] = useState(initialDeliveryConstraint)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 默认：三个 CLI 各一个 runner，模型选列表第一个
  useEffect(() => {
    if (agents.length && runners.length === 0) {
      const readyAgents = agents.filter((agent) => agent.health?.ready !== false)
      setRunners((readyAgents.length ? readyAgents : agents).map((a) => ({
        key: ++uid,
        agentId: a.id,
        model: a.models?.[0] || '',
        providerId: '',
        strictModel: true,
      })))
    }
  }, [agents]) // eslint-disable-line react-hooks/exhaustive-deps

  const agentOf = (id) => agents.find((a) => a.id === id)
  const targetAgentIds = [...new Set(runners.map((runner) => runner.agentId))]

  async function refreshSkills(nextSkills = null) {
    if (nextSkills) {
      setSkills(nextSkills)
      return
    }
    if (!user) {
      setSkills([])
      return
    }
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
      localStorage.setItem(DELIVERY_STORAGE_KEY, deliveryConstraint)
      localStorage.setItem(DELIVERY_MODE_STORAGE_KEY, deliveryPreset)
    } catch {}
  }, [deliveryConstraint, deliveryPreset])

  useEffect(() => {
    setSelectedSkills((current) =>
      current.filter((id) => {
        const skill = skills.find((item) => item.id === id)
        return skill && targetAgentIds.every((agentId) => skill.installedFor?.includes(agentId))
      })
    )
  }, [skills, runners]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <form onSubmit={handleSubmit} className="mt-8 rounded-lg border border-white/10 bg-white/[0.02]">
      <div className="flex flex-col gap-3.5 p-5">
        <Textarea
          rows={3}
          className="border-0 bg-transparent px-1 py-1 text-sm focus:bg-transparent"
          placeholder={t('task.placeholder')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div className="flex flex-wrap items-center gap-2 border-y border-white/8 py-2.5">
          <span className="mr-1 font-mono text-[9px] tracking-[0.18em] text-white/35 uppercase">
            {t('task.artifactType')}
          </span>
          {[
            ['single-html', FileCode2, t('task.deliverySingleHtml'), 'index.html'],
            ['single-svg', Shapes, t('task.deliverySingleSvg'), 'index.svg'],
            ['single-markdown', FileText, t('task.deliverySingleMarkdown'), 'plan.md'],
          ].map(([value, Icon, label, filename]) => (
            <button
              key={value}
              type="button"
              onClick={() => chooseDeliveryPreset(value)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md border px-2.5 transition-colors',
                deliveryPreset === value
                  ? 'border-acid bg-acid/10 text-acid'
                  : 'border-white/12 text-white/45 hover:border-white/30 hover:text-white'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">{label}</span>
              <span className="hidden font-mono text-[9px] text-current opacity-45 sm:inline">{filename}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowDelivery((value) => !value)}
            className={cn(
              'ml-auto flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[9px] tracking-[0.12em] uppercase transition-colors',
              showDelivery || deliveryPreset === 'static-folder' || deliveryPreset === 'custom'
                ? 'border-white/30 text-white/75'
                : 'border-white/10 text-white/30 hover:border-white/25 hover:text-white/70'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t('task.deliveryAdvanced')}
          </button>
          <span className="w-full font-mono text-[9px] text-white/25 sm:w-auto">
            {deliveryPreset === 'single-html' && t('task.artifactSingleFile', { file: 'index.html' })}
            {deliveryPreset === 'single-svg' && t('task.artifactSingleFile', { file: 'index.svg' })}
            {deliveryPreset === 'single-markdown' && t('task.artifactSingleFile', { file: 'plan.md' })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RunnerStatus runner={runner} user={user} onLogin={onLogin} />

          <ProviderManager
            providers={providers}
            onChange={setProviders}
            user={user}
            onLogin={onLogin}
            runner={runner}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase">
                <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                {t('task.skills')}
                {selectedSkills.length > 0 && (
                  <span className="rounded-full bg-violet-400/15 px-1.5 text-violet-200">{selectedSkills.length}</span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[380px] w-[min(380px,calc(100vw-32px))] overflow-y-auto p-1.5">
              <div className="px-2 py-1.5">
                <p className="font-mono text-[9px] tracking-[0.16em] text-white/35 uppercase">{t('task.skillsLocalTitle')}</p>
                <p className="mt-1 text-[11px] leading-4 text-white/45">{t('task.skillsHelp')}</p>
              </div>
              {skills.map((skill) => {
                const installedForAll =
                  targetAgentIds.length > 0 && targetAgentIds.every((agentId) => skill.installedFor?.includes(agentId))
                const selected = selectedSkills.includes(skill.id)
                const installing = installingSkill === skill.id
                return (
                  <DropdownMenuItem
                    key={skill.id}
                    onSelect={(event) => {
                      event.preventDefault()
                      if (installedForAll) {
                        setSelectedSkills((current) =>
                          selected ? current.filter((id) => id !== skill.id) : [...current, skill.id]
                        )
                      } else if (skill.installable) {
                        installSkill(skill)
                      }
                    }}
                    className="items-start py-2"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                      {installing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />
                      ) : installedForAll ? (
                        <span className={cn('flex h-3.5 w-3.5 items-center justify-center rounded border', selected ? 'border-violet-300 bg-violet-300 text-black' : 'border-white/25')}>
                          {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                        </span>
                      ) : (
                        <Download className="h-3.5 w-3.5 text-white/35" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-xs text-white/85">
                        <span className="truncate">{skill.name}</span>
                        {skill.maintained && (
                          <span className="rounded border border-acid/25 px-1 font-mono text-[8px] tracking-wider text-acid uppercase">
                            Touchstone
                          </span>
                        )}
                        {skill.popular && !skill.maintained && (
                          <span className="rounded border border-white/12 px-1 font-mono text-[8px] tracking-wider text-white/35 uppercase">
                            Popular
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-white/40">{skill.description}</span>
                      <span className="mt-0.5 block font-mono text-[9px] text-white/25">
                        {installedForAll
                          ? t('task.skillsInstalledForAll')
                          : skill.installedFor?.length
                            ? t('task.skillsInstalledFor', { agents: skill.installedFor.join(', ') })
                            : t('task.skillsInstallAction', { agents: targetAgentIds.join(', ') || '—' })}
                      </span>
                    </span>
                  </DropdownMenuItem>
                )
              })}
              {skills.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-white/35">{skillsError || t('task.skillsNone')}</p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedSkills.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedSkills((current) => current.filter((skillId) => skillId !== id))}
              className="flex h-7 items-center gap-1 rounded-full border border-violet-300/20 bg-violet-300/8 px-2 font-mono text-[9px] text-violet-200"
            >
              {id}
              <X className="h-2.5 w-2.5" />
            </button>
          ))}
          {skillsError && <span className="text-[10px] text-amber-300">{skillsError}</span>}
        </div>

        {showDelivery && (
          <div className="rounded-md border border-white/10 bg-white/[0.025] p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                ['single-html', t('task.deliverySingleHtml')],
                ['single-svg', t('task.deliverySingleSvg')],
                ['single-markdown', t('task.deliverySingleMarkdown')],
                ['static-folder', t('task.deliveryStaticFolder')],
                ['custom', t('task.deliveryCustom')],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => chooseDeliveryPreset(value)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 font-mono text-[9px] tracking-wider uppercase',
                    deliveryPreset === value
                      ? 'border-acid bg-acid text-black'
                      : 'border-white/12 text-white/40 hover:border-white/30 hover:text-white'
                  )}
                >
                  {label}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-white/30">{t('task.deliveryAppended')}</span>
            </div>
            <Textarea
              rows={4}
              maxLength={6000}
              value={deliveryConstraint}
              onChange={(event) => {
                setDeliveryConstraint(event.target.value)
                setDeliveryPreset('custom')
              }}
              className="mt-2 min-h-24 font-mono text-[11px] leading-5"
            />
          </div>
        )}

        <div className="h-px bg-white/8" />

        <div className="flex flex-wrap items-center gap-2">
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
                <button
                  type="button"
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
            <DropdownMenuContent align="start">
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
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-3">
            {runners.length > 1 && (
              <span
                className="hidden items-center gap-1 font-mono text-[9px] tracking-[0.1em] text-emerald-300/65 uppercase sm:flex"
                title={t('provider.concurrentHelp')}
              >
                <Zap className="h-3 w-3" />
                {t('provider.concurrent', { count: runners.length })}
              </span>
            )}
            {error && <span className="font-mono text-xs text-red-400">{error}</span>}
            <span className="flex items-center gap-1">
              <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase select-none">
                <input
                  type="checkbox"
                  checked={publish}
                  onChange={(e) => setPublish(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border transition-colors',
                    publish ? 'border-acid bg-acid text-black' : 'border-white/25'
                  )}
                >
                  {publish && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                </span>
                <span className={publish ? 'text-white/80' : 'text-white/40'}>{t('task.publish')}</span>
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    title={t('task.publishHelpTitle')}
                    className="cursor-pointer text-white/25 outline-none transition-colors hover:text-white"
                  >
                    <CircleHelp className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[280px] p-3">
                  <p className="font-mono text-[10px] font-bold tracking-[0.18em] text-acid uppercase">{t('task.publishHelpHeading')}</p>
                  <p className="mt-2 text-xs leading-5 text-white/70">
                    {t('task.publishHelpBody')}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-white/45">{t('task.publishHelpFoot')}</p>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
            <Button disabled={busy || !runner?.canExecute} className="h-8 font-mono text-[11px] font-bold tracking-[0.15em] uppercase">
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
