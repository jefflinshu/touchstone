import { useState, useEffect } from 'react'
import { Zap, Loader2, Sparkles } from 'lucide-react'

export default function TaskForm({ agents, onSubmit }) {
  const [project, setProject] = useState('')
  const [prompt, setPrompt] = useState('')
  const [selected, setSelected] = useState({})
  const [models, setModels] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // 默认全选
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
      setError('请填写项目名、任务描述，并至少选择一个模型')
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

  const inputCls =
    'rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white/90 placeholder:text-white/30 outline-none transition focus:border-clay/70 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(217,119,87,0.15)]'

  return (
    <form onSubmit={handleSubmit} className="glass mt-8 flex flex-col gap-4 rounded-3xl p-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputCls} min-w-[240px] flex-1`}
          placeholder="项目名（如 bouncing-ball）"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {agents.map((a) => (
          <div key={a.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected((s) => ({ ...s, [a.id]: !s[a.id] }))}
              className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition ${
                selected[a.id]
                  ? 'bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'border-white/10 text-white/35 hover:text-white/60'
              }`}
              style={selected[a.id] ? { borderColor: a.color, color: a.color } : {}}
            >
              {a.name}
            </button>
            {selected[a.id] && (
              <>
                <input
                  className={`${inputCls} w-[170px] px-3 py-1.5 text-xs`}
                  list={`models-${a.id}`}
                  placeholder="默认模型"
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

      <textarea
        className={`${inputCls} w-full resize-y leading-6`}
        rows={3}
        placeholder={
          '任务描述（同一个任务会并行下发给所有勾选的模型）…\n例：用纯 HTML/CSS/JS 实现一个六边形内弹跳小球的物理动画'
        }
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-white/35">
          <Sparkles className="h-3.5 w-3.5 text-clay/70" />
          每次下发均为全新独立会话 · 自动要求产出可直接打开的 index.html
        </span>
        <div className="flex items-center gap-3">
          {error && <span className="text-[13px] text-rose-400">{error}</span>}
          <button
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-clay to-clay-deep px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(217,119,87,0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {busy ? '下发中…' : '下发任务'}
          </button>
        </div>
      </div>
    </form>
  )
}
