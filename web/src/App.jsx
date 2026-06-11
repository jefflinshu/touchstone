import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import TaskForm from './components/TaskForm.jsx'
import RunCard from './components/RunCard.jsx'

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
              className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase transition-colors hover:text-white"
            >
              GitHub ↗
            </a>
            <span
              className={`h-1.5 w-1.5 rounded-full ${wsOk ? 'bg-acid shadow-[0_0_6px_rgba(212,255,79,0.9)]' : 'bg-red-500'}`}
              title={wsOk ? 'live' : 'disconnected'}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 pb-28">
        <TaskForm agents={agents} onSubmit={submitTask} />

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

        <main className="flex flex-col gap-14">
          {groups.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/12 py-20 text-center font-mono text-xs tracking-[0.2em] text-white/30 uppercase">
              No runs yet
            </div>
          )}
          {groups.map((g) => (
            <section key={g.project}>
              <div className="mb-4 flex items-baseline gap-4">
                <h2 className="text-xl font-semibold tracking-tight">{g.project}</h2>
                <span className="font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
                  {g.runs.length} runs
                </span>
              </div>
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(380px,1fr))]">
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
            </section>
          ))}
        </main>
      </div>
    </>
  )
}
