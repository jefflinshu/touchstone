import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { ChevronRight, Folder, FolderOpen, TerminalSquare, GitBranch } from 'lucide-react'
import TaskForm from './components/TaskForm.jsx'
import RunCard from './components/RunCard.jsx'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CONSENT_KEY = 'touchstone-consent-v1'

function ConsentDialog({ open, onAgree }) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="w-[440px] rounded-lg p-6"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="font-mono text-sm font-bold tracking-[0.2em] uppercase">
          开始之前
        </DialogTitle>
        <div className="mt-4 flex flex-col gap-3.5 text-[13px] leading-6 text-white/75">
          <p className="flex gap-2.5">
            <TerminalSquare className="mt-1 h-4 w-4 shrink-0 text-acid" />
            Touchstone 将以全自动模式驱动你本地安装的 Claude Code / Codex / Gemini CLI 执行你下发的任务。
          </p>
          <p className="flex gap-2.5">
            <GitBranch className="mt-1 h-4 w-4 shrink-0 text-acid" />
            <span>
              任务产出的作品代码会自动 commit 并上传到公开的 showcases 仓库{' '}
              <a
                href="https://github.com/jefflinshu/touchstone"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-white/30 underline-offset-2 hover:text-white"
              >
                github.com/jefflinshu/touchstone
              </a>
            </span>
          </p>
          <p className="text-[11px] text-white/40">
            请只下发可信任务。自动上传可在 agents.json 的 defaults.git 中关闭。
          </p>
        </div>
        <Button onClick={onAgree} className="mt-5 w-full font-mono text-[11px] font-bold tracking-[0.15em] uppercase">
          同意并开始
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function GithubIcon({ className }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

const LOG_CAP = 30000

export default function App() {
  const [agents, setAgents] = useState([])
  const [runs, setRuns] = useState([])
  const [logs, setLogs] = useState({})
  const [wsOk, setWsOk] = useState(false)
  const wsRef = useRef(null)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/runs').then((r) => r.json())
    setRuns(r.runs)
  }, [])

  useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((d) => setAgents(d.agents))
    refresh()
  }, [refresh])

  // WebSocket 实时更新（断线自动重连）
  useEffect(() => {
    let closed = false
    let retry = null
    function connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${location.host}/ws`)
      wsRef.current = ws
      ws.onopen = () => {
        setWsOk(true)
        refresh()
      }
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'run') {
          setRuns((prev) => {
            const idx = prev.findIndex((r) => r.id === msg.run.id)
            if (idx === -1) return [msg.run, ...prev]
            const next = [...prev]
            next[idx] = msg.run
            return next
          })
        } else if (msg.type === 'log') {
          setLogs((prev) => {
            const cur = (prev[msg.runId] || '') + msg.chunk
            return { ...prev, [msg.runId]: cur.length > LOG_CAP ? cur.slice(-LOG_CAP) : cur }
          })
        } else if (msg.type === 'removed') {
          setRuns((prev) => prev.filter((r) => r.id !== msg.runId))
        }
      }
      ws.onclose = () => {
        setWsOk(false)
        if (!closed) retry = setTimeout(connect, 2000)
      }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      wsRef.current?.close()
    }
  }, [refresh])

  const [expanded, setExpanded] = useState(() => new Set())
  const expandedInit = useRef(false)
  const [consent, setConsent] = useState(() => localStorage.getItem(CONSENT_KEY) === '1')

  const submitTask = useCallback(async (payload) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'failed')
    }
    const data = await res.json()
    if (data.project) setExpanded((prev) => new Set(prev).add(data.project))
  }, [])

  const stopRun = useCallback(async (id) => {
    await fetch(`/api/runs/${id}/stop`, { method: 'POST' })
  }, [])

  const deleteRun = useCallback(async (id) => {
    await fetch(`/api/runs/${id}`, { method: 'DELETE' })
    setRuns((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const fetchLog = useCallback(async (id) => {
    const text = await fetch(`/api/runs/${id}/log`).then((r) => r.text())
    setLogs((prev) => ({ ...prev, [id]: text.length > LOG_CAP ? text.slice(-LOG_CAP) : text }))
  }, [])

  const groups = useMemo(() => {
    const map = new Map()
    for (const run of runs) {
      if (!map.has(run.project)) map.set(run.project, [])
      map.get(run.project).push(run)
    }
    const arr = [...map.entries()].map(([project, list]) => ({
      project,
      runs: [...list].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
      latest: list.reduce((m, r) => (r.createdAt > m ? r.createdAt : m), ''),
    }))
    arr.sort((a, b) => (a.latest > b.latest ? -1 : 1))
    return arr
  }, [runs])

  const active = runs.filter((r) => r.status === 'running' || r.status === 'pending').length

  // 首次加载默认展开最新项目
  useEffect(() => {
    if (!expandedInit.current && groups.length) {
      expandedInit.current = true
      setExpanded(new Set([groups[0].project]))
    }
  }, [groups])

  const toggle = (project) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(project) ? next.delete(project) : next.add(project)
      return next
    })

  return (
    <>
      <div className="bg-arena" />
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-6">
          <span className="font-mono text-[15px] font-bold tracking-[0.25em] text-white">
            TOUCHSTONE<span className="text-acid">_</span>
          </span>
          <span className="mt-px font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase">
            AI Coding Arena
          </span>
          <div className="ml-auto flex items-center gap-4">
            {active > 0 && (
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-acid uppercase">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-acid" />
                {active} running
              </span>
            )}
            <a
              href="https://github.com/jefflinshu/touchstone"
              target="_blank"
              rel="noreferrer"
              className="text-white/40 transition-colors hover:text-white"
              title="GitHub"
            >
              <GithubIcon className="h-4 w-4" />
            </a>
            <span
              className={`h-1.5 w-1.5 rounded-full ${wsOk ? 'bg-acid shadow-[0_0_6px_rgba(212,255,79,0.9)]' : 'bg-red-500'}`}
              title={wsOk ? 'live' : 'disconnected'}
            />
          </div>
        </div>
      </header>

      <ConsentDialog
        open={!consent}
        onAgree={() => {
          localStorage.setItem(CONSENT_KEY, '1')
          setConsent(true)
        }}
      />

      <div className="mx-auto max-w-[1400px] px-6 pb-28">
        <TaskForm agents={agents} onSubmit={submitTask} disabled={!consent} />

        <div className="mt-10 mb-4 flex items-center gap-6 font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
          <span>
            Projects <span className="text-white/70">{groups.length}</span>
          </span>
          <span>
            Runs <span className="text-white/70">{runs.length}</span>
          </span>
          <span>
            Active <span className={active ? 'text-acid' : 'text-white/70'}>{active}</span>
          </span>
          <span className="h-px flex-1 bg-white/8" />
        </div>

        <main className="flex flex-col gap-3">
          {groups.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/12 py-20 text-center font-mono text-xs tracking-[0.2em] text-white/30 uppercase">
              No runs yet
            </div>
          )}
          {groups.map((g) => {
            const open = expanded.has(g.project)
            const running = g.runs.filter((r) => r.status === 'running' || r.status === 'pending').length
            const done = g.runs.filter((r) => r.status === 'done').length
            const failed = g.runs.length - running - done
            return (
              <section
                key={g.project}
                className={cn(
                  'overflow-hidden rounded-lg border transition-colors',
                  open ? 'border-white/15 bg-white/[0.015]' : 'border-white/10 hover:border-white/25'
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(g.project)}
                  className="flex h-12 w-full cursor-pointer items-center gap-3 px-4 text-left"
                >
                  <ChevronRight
                    className={cn('h-3.5 w-3.5 shrink-0 text-white/35 transition-transform', open && 'rotate-90')}
                  />
                  {open ? (
                    <FolderOpen className="h-4 w-4 shrink-0 text-acid/80" />
                  ) : (
                    <Folder className="h-4 w-4 shrink-0 text-white/40" />
                  )}
                  <span className="truncate text-[15px] font-semibold tracking-tight">{g.project}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-4 font-mono text-[11px] tabular-nums">
                    {running > 0 && (
                      <span className="flex items-center gap-1.5 text-acid">
                        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-acid" />
                        {running}
                      </span>
                    )}
                    {done > 0 && (
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {done}
                      </span>
                    )}
                    {failed > 0 && (
                      <span className="flex items-center gap-1.5 text-red-400/80">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500/80" />
                        {failed}
                      </span>
                    )}
                    <span className="text-white/30">
                      {new Date(g.latest).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </button>
                {open && (
                  <div className="grid gap-4 border-t border-white/8 p-4 [grid-template-columns:repeat(auto-fill,minmax(380px,1fr))]">
                    {g.runs.map((run) => (
                      <RunCard
                        key={run.id}
                        run={run}
                        log={logs[run.id]}
                        onStop={stopRun}
                        onDelete={deleteRun}
                        onFetchLog={fetchLog}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </main>
      </div>
    </>
  )
}
