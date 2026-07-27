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

function ModelPicker({ agent, value, onChange }) {
  const selectedHealth = agent.health?.modelHealth?.[value]
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
      <DropdownMenuContent align="start" className="font-mono text-[11px]">
        {(agent.models || []).map((m) => {
          const modelHealth = agent.health?.modelHealth?.[m]
          return (
          <DropdownMenuItem key={m} onSelect={() => onChange(m)} title={modelHealth?.fix || undefined}>
            <AgentIcon agentId={agent.id} color={agent.color} className="h-3 w-3" />
            <span className={cn(modelHealth?.available === false && 'text-amber-400')}>{m}</span>
            {modelHealth?.available === false && <TriangleAlert className="ml-auto h-3 w-3 text-amber-400" />}
          </DropdownMenuItem>
          )
        })}
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

export default function TaskForm({ agents, onSubmit, user, onLogin }) {
  const { t } = useI18n()
  const [prompt, setPrompt] = useState('')
  const [runners, setRunners] = useState([])
  const [publish, setPublish] = useState(false)
  const [skills, setSkills] = useState([])
  const [skillsInstallEnabled, setSkillsInstallEnabled] = useState(false)
  const [selectedSkills, setSelectedSkills] = useState([])
  const [installingSkill, setInstallingSkill] = useState('')
  const [skillsError, setSkillsError] = useState('')
  const [showDelivery, setShowDelivery] = useState(false)
  const [deliveryPreset, setDeliveryPreset] = useState(initialDeliveryMode)
  const [deliveryConstraint, setDeliveryConstraint] = useState(initialDeliveryConstraint)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 默认：三个 CLI 各一个 runner，模型选列表第一个
  useEffect(() => {
    if (agents.length && runners.length === 0) {
      const readyAgents = agents.filter((agent) => agent.health?.ready !== false)
      setRunners((readyAgents.length ? readyAgents : agents).map((a) => ({ key: ++uid, agentId: a.id, model: a.models?.[0] || '' })))
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
        runners: runners.map(({ agentId, model }) => ({ agentId, model: model.trim() })),
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

        <div className="flex flex-wrap items-center gap-2">
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

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDelivery((value) => !value)}
            className={cn(
              'h-8 gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase',
              showDelivery && 'border-acid/50 text-acid'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {deliveryPreset === 'single-html'
              ? t('task.deliverySingleHtml')
              : deliveryPreset === 'single-svg'
                ? t('task.deliverySingleSvg')
                : deliveryPreset === 'single-markdown'
                  ? t('task.deliverySingleMarkdown')
                  : t('task.delivery')}
          </Button>

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
          <div className="rounded-md border border-white/10 bg-black/20 p-3">
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
            const modelHealth = a.health?.modelHealth?.[r.model]
            const ready = a.health?.ready !== false && modelHealth?.available !== false
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
                <ModelPicker
                  agent={a}
                  value={r.model}
                  onChange={(v) => setRunners((rs) => rs.map((x) => (x.key === r.key ? { ...x, model: v } : x)))}
                />
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
                    setRunners((rs) => [...rs, { key: ++uid, agentId: a.id, model: a.models?.[0] || '' }])
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
            <Button disabled={busy} className="h-8 font-mono text-[11px] font-bold tracking-[0.15em] uppercase">
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
