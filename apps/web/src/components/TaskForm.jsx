import { useState, useEffect } from 'react'
import { Loader2, ArrowRight, Plus, X, Check, ChevronDown, TriangleAlert, CircleHelp } from 'lucide-react'
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

function ModelPicker({ agent, value, onChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-full max-w-[180px] cursor-pointer items-center gap-1 border-l border-white/10 px-2 font-mono text-[11px] whitespace-nowrap text-white/55 outline-none transition-colors hover:text-white"
        >
          <span className="truncate">{value}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="font-mono text-[11px]">
        {(agent.models || []).map((m) => (
          <DropdownMenuItem key={m} onSelect={() => onChange(m)}>
            <AgentIcon agentId={agent.id} color={agent.color} className="h-3 w-3" />
            {m}
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

export default function TaskForm({ agents, onSubmit, user, onLogin }) {
  const { t } = useI18n()
  const [prompt, setPrompt] = useState('')
  const [runners, setRunners] = useState([])
  const [publish, setPublish] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 默认：三个 CLI 各一个 runner，模型选列表第一个
  useEffect(() => {
    if (agents.length && runners.length === 0) {
      setRunners(agents.map((a) => ({ key: ++uid, agentId: a.id, model: a.models?.[0] || '' })))
    }
  }, [agents]) // eslint-disable-line react-hooks/exhaustive-deps

  const agentOf = (id) => agents.find((a) => a.id === id)

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
    setBusy(true)
    try {
      await onSubmit({
        prompt: prompt.trim(),
        runners: runners.map(({ agentId, model }) => ({ agentId, model: model.trim() })),
        publish,
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

        <div className="h-px bg-white/8" />

        <div className="flex flex-wrap items-center gap-2">
          {runners.map((r) => {
            const a = agentOf(r.agentId)
            if (!a) return null
            const ready = a.health?.ready !== false
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
                  {!ready && <HealthHint agent={a} />}
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
