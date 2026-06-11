import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Activity, Gem } from 'lucide-react'
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
      throw new Error(err.error || '提交失败')
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

  // 按项目分组，组按最新活动排序
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

  const runningCount = runs.filter((r) => r.status === 'running' || r.status === 'pending').length

  return (
    <>
      <div className="aurora" />
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-black/25 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-6 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="flex items-center gap-2 text-xl font-bold tracking-wide">
              <Gem className="h-5 w-5 text-clay" strokeWidth={2.2} />
              <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Touchstone
              </span>
            </span>
            <span className="text-xs text-white/40">多模型试金石 · AI Coding Arena</span>
          </div>
          <div className="flex items-center gap-3">
            {runningCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-clay/50 bg-clay/10 px-3 py-1 text-xs text-clay shimmer">
                <Activity className="h-3.5 w-3.5" />
                {runningCount} 个任务运行中
              </span>
            )}
            <span
              className={`h-2 w-2 rounded-full transition-colors ${wsOk ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500'}`}
              title={wsOk ? '实时连接正常' : '连接断开'}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-6 pb-24">
        <TaskForm agents={agents} onSubmit={submitTask} />

        <main className="mt-10 flex flex-col gap-12">
          {groups.length === 0 && (
            <div className="glass rounded-3xl px-8 py-16 text-center leading-8 text-white/45">
              还没有任务。在上方输入项目名和任务描述，选择模型，点击「下发任务」——
              <br />
              各家 CLI 会并行开工，作品完成后自动出现在这里。
            </div>
          )}
          {groups.map((g) => (
            <section key={g.project}>
              <h2 className="mb-4 flex items-baseline gap-2.5 text-lg font-semibold">
                <span className="h-4 w-1 self-center rounded-full bg-gradient-to-b from-clay to-clay-deep" />
                {g.project}
                <span className="text-xs font-normal text-white/35">{g.runs.length} 次运行</span>
              </h2>
              <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(390px,1fr))]">
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
