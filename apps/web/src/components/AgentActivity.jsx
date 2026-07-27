import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDot,
  Loader2,
  MessageCircleQuestion,
  Send,
  Terminal,
  Wrench,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n.jsx'

const EVENT_STATUS = {
  completed: { icon: CheckCircle2, color: 'text-emerald-400' },
  answered: { icon: CheckCircle2, color: 'text-emerald-400' },
  failed: { icon: XCircle, color: 'text-red-400' },
  pending: { icon: Circle, color: 'text-white/30' },
  running: { icon: Loader2, color: 'text-acid' },
}

function Markdown({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children: label, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="text-acid underline decoration-acid/35 underline-offset-2">{label}</a>,
        p: ({ children: content }) => <p className="mb-2 last:mb-0">{content}</p>,
        ul: ({ children: content }) => <ul className="my-2 list-disc space-y-1 pl-5">{content}</ul>,
        ol: ({ children: content }) => <ol className="my-2 list-decimal space-y-1 pl-5">{content}</ol>,
        h1: ({ children: content }) => <h1 className="mb-2 mt-3 text-base font-semibold text-white">{content}</h1>,
        h2: ({ children: content }) => <h2 className="mb-2 mt-3 text-sm font-semibold text-white">{content}</h2>,
        h3: ({ children: content }) => <h3 className="mb-1.5 mt-2 font-semibold text-white/90">{content}</h3>,
        blockquote: ({ children: content }) => <blockquote className="my-2 border-l-2 border-acid/45 pl-3 text-white/55">{content}</blockquote>,
        pre: ({ children: content }) => <pre className="my-2 overflow-auto rounded-md border border-white/8 bg-black/70 p-3 font-mono text-[10px] leading-5 text-white/70">{content}</pre>,
        code: ({ className, children: content, ...props }) =>
          className ? (
            <code className={className} {...props}>{content}</code>
          ) : (
            <code className="rounded bg-white/8 px-1 py-0.5 font-mono text-[0.9em] text-white/80" {...props}>{content}</code>
          ),
        table: ({ children: content }) => <div className="my-2 overflow-auto"><table className="w-full border-collapse text-left text-[11px]">{content}</table></div>,
        th: ({ children: content }) => <th className="border border-white/10 bg-white/5 px-2 py-1 font-medium text-white/75">{content}</th>,
        td: ({ children: content }) => <td className="border border-white/10 px-2 py-1 text-white/60">{content}</td>,
      }}
    >
      {children || ''}
    </ReactMarkdown>
  )
}
function StatusIcon({ status, className }) {
  const config = EVENT_STATUS[status] || EVENT_STATUS.running
  const Icon = config.icon
  return <Icon className={cn('h-3.5 w-3.5 shrink-0', config.color, status === 'running' && 'animate-spin', className)} />
}

function ToolBlock({ event }) {
  const hasDetails = event.input != null || event.output
  const input = typeof event.input === 'string' ? event.input : event.input == null ? '' : JSON.stringify(event.input, null, 2)
  return (
    <details className="group/tool overflow-hidden rounded-md border border-white/8 bg-white/[0.025]" open={event.status === 'failed'}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[11px] marker:hidden">
        <Wrench className="h-3.5 w-3.5 shrink-0 text-sky-300/80" />
        <span className="min-w-0 flex-1 truncate font-mono text-white/70">{event.title || event.tool || 'Tool'}</span>
        <StatusIcon status={event.status} />
        {hasDetails && <ChevronRight className="h-3.5 w-3.5 text-white/20 transition-transform group-open/tool:rotate-90" />}
      </summary>
      {hasDetails && (
        <div className="space-y-2 border-t border-white/8 px-3 py-2.5">
          {input && <pre className="max-h-36 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-5 text-white/45">{input}</pre>}
          {event.output && <pre className="max-h-44 overflow-auto border-t border-white/8 pt-2 whitespace-pre-wrap font-mono text-[10px] leading-5 text-white/65">{event.output}</pre>}
        </div>
      )}
    </details>
  )
}

function ProgressBlock({ event }) {
  const items = event.items || []
  const done = items.filter((item) => item.status === 'completed').length
  const percent = items.length ? Math.round((done / items.length) * 100) : 0
  return (
    <section className="rounded-md border border-acid/15 bg-acid/[0.035] px-3 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        <CircleDot className="h-3.5 w-3.5 text-acid" />
        <span className="font-mono text-[10px] tracking-[0.12em] text-white/65 uppercase">{event.title || 'Task progress'}</span>
        <span className="ml-auto font-mono text-[10px] text-white/30">{done}/{items.length}</span>
      </div>
      <div className="mb-2 h-px overflow-hidden bg-white/8">
        <div className="h-full bg-acid transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2 text-[11px] leading-4 text-white/55">
            {item.status === 'completed' ? <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" /> : item.status === 'running' ? <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-acid" /> : <Circle className="mt-0.5 h-3 w-3 shrink-0 text-white/25" />}
            <span className={item.status === 'completed' ? 'text-white/35 line-through' : ''}>{item.content}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function QuestionBlock({ event, runId }) {
  const { language } = useI18n()
  const [answer, setAnswer] = useState(event.answer || '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const answered = event.status === 'answered'
  const question = event.questions?.[0] || {}
  const options = question.options || []

  const submit = async (value = answer) => {
    const text = String(value || '').trim()
    if (!text || sending || answered) return
    setSending(true)
    setError('')
    try {
      const response = await fetch(`/api/runs/${runId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: event.id, answer: text }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to send')
      setAnswer(text)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="rounded-md border border-amber-300/25 bg-amber-300/[0.045] p-3">
      <div className="mb-2 flex items-center gap-2">
        <MessageCircleQuestion className="h-4 w-4 text-amber-300" />
        <span className="font-mono text-[10px] tracking-[0.12em] text-amber-100/70 uppercase">{event.title || (language === 'zh' ? '需要你的输入' : 'Needs your input')}</span>
        {answered && <span className="ml-auto font-mono text-[9px] text-emerald-400 uppercase">answered</span>}
      </div>
      <p className="text-[12px] leading-5 text-white/80">{question.question || question.header}</p>
      {!answered && (
        <>
          {options.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {options.map((option) => {
                const value = option.label || option.value || option.description
                return <button key={value} type="button" onClick={() => submit(value)} className="rounded border border-white/15 px-2 py-1 text-[10px] text-white/65 transition-colors hover:border-amber-300/45 hover:text-white">{value}</button>
              })}
            </div>
          )}
          <div className="mt-2 flex gap-1.5">
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder={language === 'zh' ? '输入回答…' : 'Type an answer…'} className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2.5 py-1.5 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-amber-300/45" />
            <button type="button" onClick={() => submit()} disabled={!answer.trim() || sending} className="flex h-7 w-8 items-center justify-center rounded bg-amber-300 text-black disabled:opacity-35">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
          {error && <p className="mt-1.5 text-[10px] text-red-400">{error}</p>}
        </>
      )}
      {answered && <p className="mt-2 border-l border-emerald-400/35 pl-2 text-[11px] text-white/55">{event.answer}</p>}
    </section>
  )
}

function EventBlock({ event, runId }) {
  if (event.kind === 'assistant') {
    return (
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-acid/25 bg-acid/5">
          <Bot className="h-3 w-3 text-acid" />
        </div>
        <div className="min-w-0 flex-1 text-[12px] leading-[1.65] text-white/72">
          <Markdown>{event.content}</Markdown>
          {event.status === 'running' && <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-acid align-middle" />}
        </div>
      </div>
    )
  }
  if (event.kind === 'tool') return <ToolBlock event={event} />
  if (event.kind === 'progress') return <ProgressBlock event={event} />
  if (event.kind === 'question') return <QuestionBlock event={event} runId={runId} />
  if (event.kind === 'raw') {
    return <pre className="max-h-48 overflow-auto rounded-md border border-white/8 bg-black/45 p-3 whitespace-pre-wrap font-mono text-[10px] leading-5 text-white/45">{event.content}</pre>
  }
  return (
    <div className="flex items-start gap-2 px-1 py-0.5 text-[10px] text-white/35">
      <StatusIcon status={event.status} className="mt-px" />
      <span className="font-mono">{event.title || event.content}</span>
    </div>
  )
}

export default function AgentActivity({ run, events = [], rawLog = '' }) {
  const { language } = useI18n()
  const scrollRef = useRef(null)
  const followRef = useRef(true)
  const visibleEvents = useMemo(() => {
    if (events.length) return events.filter((event) => event.kind !== 'raw' || events.length === 1)
    return rawLog ? [{ id: 'legacy-log', kind: 'raw', status: 'completed', content: rawLog }] : []
  }, [events, rawLog])
  const toolCount = visibleEvents.filter((event) => event.kind === 'tool').length

  useEffect(() => {
    if (followRef.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [visibleEvents])

  return (
    <div className="absolute inset-0 flex flex-col bg-[#09090b]">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-white/8 px-3">
        <span className={cn('h-1.5 w-1.5 rounded-full', run.status === 'running' || run.status === 'pending' ? 'bg-acid shadow-[0_0_7px_rgba(212,255,79,.7)]' : run.status === 'done' ? 'bg-emerald-400' : 'bg-red-400')} />
        <span className="font-mono text-[9px] tracking-[0.16em] text-white/45 uppercase">{run.status === 'running' ? 'live activity' : 'agent activity'}</span>
        {toolCount > 0 && <span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-white/25"><Terminal className="h-3 w-3" />{toolCount}</span>}
      </header>
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64
        }}
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3 [scrollbar-color:rgba(255,255,255,.16)_transparent]"
      >
        {visibleEvents.length ? (
          visibleEvents.map((event) => <EventBlock key={event.id} event={event} runId={run.id} />)
        ) : (
          <div className="flex h-full items-center justify-center gap-2 font-mono text-[10px] tracking-wider text-white/25 uppercase">
            {run.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {language === 'zh' ? '等待 Agent 事件…' : 'Waiting for agent events…'}
          </div>
        )}
      </div>
    </div>
  )
}
