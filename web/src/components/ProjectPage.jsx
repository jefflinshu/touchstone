import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Copy, Check, Share2, LayoutGrid } from 'lucide-react'
import RunCard from './RunCard.jsx'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const LAYOUTS = [
  { key: 'auto', label: 'Auto' },
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
]

function useCopy() {
  const [copied, setCopied] = useState(false)
  return [
    copied,
    (text) => {
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    },
  ]
}

// 本会话内同一项目只计一次浏览
const viewedProjects = new Set()

export default function ProjectPage({ project, runs, logs, onBack, onStop, onDelete, onFetchLog }) {
  const [layout, setLayout] = useState('2')
  const [hidden, setHidden] = useState(() => new Set())

  useEffect(() => {
    if (viewedProjects.has(project)) return
    viewedProjects.add(project)
    fetch(`/api/projects/${encodeURIComponent(project)}/view`, { method: 'POST' }).catch(() => {})
  }, [project])
  const [promptCopied, copyPrompt] = useCopy()
  const [linkCopied, copyLink] = useCopy()

  const latest = runs[runs.length - 1]
  const prompt = latest?.prompt || ''

  const visibleRuns = useMemo(() => runs.filter((r) => !hidden.has(r.id)), [runs, hidden])

  const gridStyle =
    layout === 'auto'
      ? { gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }
      : { gridTemplateColumns: `repeat(${layout}, 1fr)` }

  return (
    <div className="mt-6">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="font-mono text-[10px] tracking-[0.15em] uppercase">
          <ArrowLeft className="h-3 w-3" /> Back
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">{project}</h1>
        <span className="font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
          {runs.length} runs
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto font-mono text-[10px] tracking-[0.15em] uppercase"
          onClick={() => copyLink(location.href)}
        >
          {linkCopied ? <Check className="h-3 w-3 text-acid" /> : <Share2 className="h-3 w-3" />}
          {linkCopied ? 'Copied' : 'Share'}
        </Button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 左侧：提示词 */}
        <aside className="w-full shrink-0 lg:w-[300px]">
          <div className="sticky top-20 rounded-lg border border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
              <span className="font-mono text-[10px] tracking-[0.2em] text-white/35 uppercase">Prompt</span>
              <button
                type="button"
                onClick={() => copyPrompt(prompt)}
                className="flex cursor-pointer items-center gap-1 font-mono text-[10px] tracking-wider text-white/45 uppercase transition-colors hover:text-white"
              >
                {promptCopied ? <Check className="h-3 w-3 text-acid" /> : <Copy className="h-3 w-3" />}
                {promptCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="max-h-[50vh] overflow-auto px-4 py-3.5 text-[13px] leading-6 whitespace-pre-wrap text-white/75">
              {prompt}
            </p>
            <div className="border-t border-white/8 px-4 py-3 font-mono text-[10px] leading-5 tracking-wider text-white/30 uppercase">
              {latest && <div>Created {new Date(latest.createdAt).toLocaleString('en-GB')}</div>}
              <div>{new Set(runs.map((r) => r.agentName)).size} agents · {runs.length} runs</div>
            </div>
          </div>
        </aside>

        {/* 右侧：作品宫格 */}
        <main className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
              <LayoutGrid className="h-3 w-3" /> Layout
            </span>
            <div className="flex overflow-hidden rounded-md border border-white/12">
              {LAYOUTS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setLayout(l.key)}
                  className={cn(
                    'cursor-pointer px-3 py-1 font-mono text-[10px] tracking-wider uppercase transition-colors',
                    layout === l.key ? 'bg-acid text-black' : 'text-white/45 hover:text-white'
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <span className="mx-1 h-4 w-px bg-white/10" />
            {runs.map((r) => {
              const on = !hidden.has(r.id)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    setHidden((prev) => {
                      const next = new Set(prev)
                      next.has(r.id) ? next.delete(r.id) : next.add(r.id)
                      return next
                    })
                  }
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] transition-colors',
                    on ? 'border-white/25 text-white/80' : 'border-white/8 text-white/25'
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color, opacity: on ? 1 : 0.3 }} />
                  {r.agentName}
                  {(r.model || r.resolvedModel) && <span className="text-white/40">{r.model || r.resolvedModel}</span>}
                </button>
              )
            })}
          </div>

          <div className="grid gap-4" style={gridStyle}>
            {visibleRuns.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                log={logs[run.id]}
                onStop={onStop}
                onDelete={onDelete}
                onFetchLog={onFetchLog}
              />
            ))}
          </div>
          {visibleRuns.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/12 py-16 text-center font-mono text-xs tracking-[0.2em] text-white/30 uppercase">
              All runners hidden
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
