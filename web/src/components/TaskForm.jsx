import { useState, useEffect } from 'react'
import { Loader2, ArrowRight, Plus, X, ChevronDown, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

let uid = 0

function ModelPicker({ agent, value, onChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-full cursor-pointer items-center gap-1 border-l border-white/10 px-2 font-mono text-[11px] text-white/55 outline-none transition-colors hover:text-white"
        >
          {value}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="font-mono text-[11px]">
        {(agent.models || []).map((m) => (
          <DropdownMenuItem key={m} onSelect={() => onChange(m)}>
            {m}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function TaskForm({ agents, onSubmit, disabled }) {
  const [prompt, setPrompt] = useState('')
  const [runners, setRunners] = useState([])
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
    if (!prompt.trim() || runners.length === 0) {
      setError('required')
      return
    }
    setBusy(true)
    try {
      await onSubmit({
        prompt: prompt.trim(),
        runners: runners.map(({ agentId, model }) => ({ agentId, model: model.trim() })),
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
          placeholder="描述任务…（项目名自动生成）"
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
                <span className="flex h-full items-center gap-1.5 pl-2.5 text-xs font-medium">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.color }} />
                  {a.name}
                  {!ready && (
                    <TriangleAlert className="h-3 w-3 text-amber-400" title={a.health?.fix} />
                  )}
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
              <Button type="button" variant="outline" size="sm" className="h-8 font-mono text-[10px] tracking-[0.15em] uppercase">
                <Plus className="h-3 w-3" /> Add
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
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.color }} />
                  {a.name}
                  {a.health?.ready === false && <TriangleAlert className="ml-auto h-3 w-3 text-amber-400" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-2.5">
            {error && <span className="font-mono text-xs text-red-400">{error}</span>}
            <Button
              disabled={busy || disabled}
              className="h-8 font-mono text-[11px] font-bold tracking-[0.15em] uppercase"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? 'Naming' : 'Run'}
              {!busy && <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {agents.some((a) => a.health?.ready === false) && (
          <div className="flex flex-col gap-1">
            {agents
              .filter((a) => a.health?.ready === false)
              .map((a) => (
                <span key={a.id} className="flex items-center gap-1.5 font-mono text-[11px] text-amber-400/90">
                  <TriangleAlert className="h-3 w-3 shrink-0" />
                  {a.name}: {a.health.fix}
                </span>
              ))}
          </div>
        )}
      </div>
    </form>
  )
}
