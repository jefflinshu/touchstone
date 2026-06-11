import { useState, useEffect } from 'react'
import { Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function TaskForm({ agents, onSubmit }) {
  const [project, setProject] = useState('')
  const [prompt, setPrompt] = useState('')
  const [selected, setSelected] = useState({})
  const [models, setModels] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setSelected((prev) => {
      const next = { ...prev }
      for (const a of agents) if (!(a.id in next)) next[a.id] = true
      return next
    })
  }, [agents])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const agentIds = agents.filter((a) => selected[a.id]).map((a) => a.id)
    if (!project.trim() || !prompt.trim() || agentIds.length === 0) {
      setError('project / prompt / agents required')
      return
    }
    setBusy(true)
    try {
      await onSubmit({ project: project.trim(), prompt: prompt.trim(), agentIds, models })
      setPrompt('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 rounded-lg border border-white/10 bg-white/[0.02]"
    >
      <div className="border-b border-white/8 px-5 py-3 font-mono text-[10px] tracking-[0.2em] text-white/35 uppercase">
        New benchmark
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-3">
          <Input
            className="max-w-[300px] font-mono"
            placeholder="project-name"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            {agents.map((a) => (
              <div
                key={a.id}
                className={cn(
                  'flex h-9 items-center overflow-hidden rounded-md border transition-colors',
                  selected[a.id] ? 'border-white/20 bg-white/[0.04]' : 'border-white/8'
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelected((s) => ({ ...s, [a.id]: !s[a.id] }))}
                  className={cn(
                    'flex h-full cursor-pointer items-center gap-2 px-3 text-[13px] font-medium transition-colors',
                    selected[a.id] ? 'text-white' : 'text-white/30 hover:text-white/60'
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full transition-opacity"
                    style={{ background: a.color, opacity: selected[a.id] ? 1 : 0.3 }}
                  />
                  {a.name}
                </button>
                {selected[a.id] && (
                  <>
                    <input
                      className="h-full w-[150px] border-l border-white/10 bg-transparent px-2.5 font-mono text-[11px] text-white/70 outline-none placeholder:text-white/20"
                      list={`models-${a.id}`}
                      placeholder="default model"
                      value={models[a.id] || ''}
                      onChange={(e) => setModels((m) => ({ ...m, [a.id]: e.target.value }))}
                    />
                    <datalist id={`models-${a.id}`}>
                      {(a.models || []).map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <Textarea
          rows={3}
          placeholder="Prompt — 同一任务并行下发给所有选中的 CLI，自动要求产出 index.html"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div className="flex items-center justify-end gap-4">
          {error && <span className="font-mono text-xs text-red-400">{error}</span>}
          <Button disabled={busy} className="font-mono text-xs font-bold tracking-[0.15em] uppercase">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Run
            {!busy && <ArrowRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </form>
  )
}
