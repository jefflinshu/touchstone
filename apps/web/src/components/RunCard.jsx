import { useEffect, useRef, useState } from 'react'
import {
  Loader2,
  Maximize2,
  RotateCw,
  ExternalLink,
  Trash2,
  Square,
  Terminal,
  X,
  Heart,
  Wrench,
  Coins,
} from 'lucide-react'
import { Dialog, DialogContent, DialogClose, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import AgentIcon from './AgentIcon.jsx'
import AgentActivity from './AgentActivity.jsx'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'
import { useI18n } from '@/i18n.jsx'

const STATUS = {
  pending: { labelKey: 'run.status.pending', dot: 'bg-white/40', text: 'text-white/40' },
  running: { labelKey: 'run.status.running', dot: 'bg-acid pulse-dot', text: 'text-acid' },
  done: { labelKey: 'run.status.done', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  failed: { labelKey: 'run.status.failed', dot: 'bg-red-500', text: 'text-red-400' },
  stopped: { labelKey: 'run.status.stopped', dot: 'bg-white/40', text: 'text-white/40' },
  interrupted: { labelKey: 'run.status.interrupted', dot: 'bg-red-500/60', text: 'text-red-400/70' },
}

// 虚拟视口：作品按桌面尺寸渲染后整体缩放，保证内容完整可见
const VIEW_W = 1280
const VIEW_H = 800

function elapsed(run) {
  if (!run.startedAt) return ''
  const end = run.endedAt ? new Date(run.endedAt) : new Date()
  const sec = Math.max(0, Math.round((end - new Date(run.startedAt)) / 1000))
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m${String(sec % 60).padStart(2, '0')}s`
}

function previewUrlOf(run) {
  if (!run.entry) return null
  const folderPath = run.folder.split('/').map(encodeURIComponent).join('/')
  return `/workspace/${folderPath}/${run.entry}`
}

const fmtTokens = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n))

function Metrics({ metrics }) {
  const { t } = useI18n()
  if (!metrics) return null
  return (
    <>
      {metrics.toolCalls != null && (
        <span className="flex items-center gap-1 font-mono text-[11px] text-white/35 tabular-nums" title={t('common.toolCalls')}>
          <Wrench className="h-3 w-3" />
          {metrics.toolCalls}
        </span>
      )}
      {metrics.tokens != null && (
        <span
          className="flex items-center gap-1 font-mono text-[11px] text-white/35 tabular-nums"
          title={t('common.tokenCost', { tokens: metrics.tokens.toLocaleString(), cost: metrics.costUsd != null ? ` · $${metrics.costUsd.toFixed(3)}` : '' })}
        >
          <Coins className="h-3 w-3" />
          {fmtTokens(metrics.tokens)}
        </span>
      )}
    </>
  )
}

const LIKED_KEY = 'touchstone-liked'
const getLiked = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function LikeButton({ run }) {
  const { t } = useI18n()
  const [liked, setLiked] = useState(() => getLiked().has(run.id))
  const [count, setCount] = useState(run.likes || 0)

  // 服务器广播的最新数字优先
  useEffect(() => setCount(run.likes || 0), [run.likes])

  const toggle = () => {
    const next = !liked
    setLiked(next)
    setCount((c) => Math.max(0, c + (next ? 1 : -1)))
    const set = getLiked()
    next ? set.add(run.id) : set.delete(run.id)
    localStorage.setItem(LIKED_KEY, JSON.stringify([...set]))
    fetch(`/api/runs/${run.id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: next ? 'like' : 'unlike' }),
    }).catch(() => {})
    trackEvent('run_like', { run_id: run.id, project: run.project, liked: next })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={liked ? t('run.unlike') : t('run.like')}
      className={cn(
        'flex cursor-pointer items-center gap-1 font-mono text-[11px] tabular-nums transition-colors',
        liked ? 'text-rose-400' : 'text-white/35 hover:text-rose-300'
      )}
    >
      <Heart className={cn('h-3.5 w-3.5', liked && 'fill-rose-400')} />
      {count}
    </button>
  )
}

function ScaledPreview({ url, frameKey }) {
  const boxRef = useRef(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / VIEW_W))
    ro.observe(el)
    setScale(el.clientWidth / VIEW_W)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden">
      {scale > 0 && (
        <iframe
          key={frameKey}
          src={url}
          title={url}
          sandbox="allow-scripts allow-modals allow-pointer-lock allow-popups allow-downloads"
          referrerPolicy="no-referrer"
          loading="lazy"
          className="pointer-events-none origin-top-left border-0 bg-black"
          style={{ width: VIEW_W, height: VIEW_H, transform: `scale(${scale})` }}
        />
      )}
    </div>
  )
}

export default function RunCard({ run, log, events, onStop, onDelete, onFetchActivity }) {
  const { t } = useI18n()
  const [showActivity, setShowActivity] = useState(() => run.status === 'running' || run.status === 'pending')
  const [showFull, setShowFull] = useState(false)
  const [frameKey, setFrameKey] = useState(0)
  const [, forceTick] = useState(0)

  const isLive = run.status === 'running' || run.status === 'pending'
  const st = STATUS[run.status] || STATUS.pending
  const model = run.model || run.resolvedModel

  useEffect(() => {
    if (!isLive) return
    const t = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [isLive])

  // 完成后自动重载一次预览，确保拿到最终版本
  useEffect(() => {
    if (run.status === 'done' && run.entry) setFrameKey((k) => k + 1)
  }, [run.status, run.entry])

  useEffect(() => {
    if (showActivity && events == null) onFetchActivity(run.id)
  }, [showActivity, events, run.id, onFetchActivity])

  const previewUrl = previewUrlOf(run)

  return (
    <article
      className={cn(
        'group overflow-hidden rounded-lg border bg-[#0c0c0f] transition-colors',
        isLive ? 'border-acid/25' : 'border-white/10 hover:border-white/25'
      )}
    >
      {/* 预览区 */}
      <div
        className={cn('relative aspect-[16/10] bg-black', previewUrl && !showActivity && 'cursor-zoom-in')}
        onClick={() => previewUrl && !showActivity && setShowFull(true)}
      >
        {showActivity ? (
          <AgentActivity run={run} events={events || []} rawLog={log || ''} />
        ) : previewUrl ? (
          <ScaledPreview url={previewUrl} frameKey={frameKey} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            {isLive ? (
              <Loader2 className="h-5 w-5 animate-spin text-white/25" />
            ) : (
              <span className="font-mono text-[11px] tracking-wider text-white/25 uppercase">
                {run.status === 'failed' ? run.error || t('common.noOutput') : t('common.noOutput')}
              </span>
            )}
          </div>
        )}

        {/* 悬停操作层 */}
        <div
          className="absolute top-2 right-2 flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {previewUrl && (
            <>
              <Button variant="ghost" size="icon" className="bg-black/70 backdrop-blur" title={t('common.fullscreen')} onClick={() => setShowFull(true)}>
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="bg-black/70 backdrop-blur" title={t('common.reload')} onClick={() => setFrameKey((k) => k + 1)}>
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="bg-black/70 backdrop-blur" title={t('common.open')} asChild={false} onClick={() => window.open(previewUrl, '_blank')}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn('bg-black/70 backdrop-blur', showActivity && 'text-acid')}
            title={showActivity ? t('common.preview') : t('common.log')}
            onClick={() => setShowActivity((s) => !s)}
          >
            <Terminal className="h-3.5 w-3.5" />
          </Button>
          {isLive ? (
            <Button variant="ghost" size="icon" className="bg-black/70 backdrop-blur hover:text-red-400" title={t('common.stop')} onClick={() => onStop(run.id)}>
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="bg-black/70 backdrop-blur hover:text-red-400"
              title={t('common.delete')}
              onClick={() => confirm(t('project.deleteConfirm', { folder: run.folder })) && onDelete(run.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* 数据行 */}
      <footer className="flex min-h-11 flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-white/8 px-3.5 py-2 sm:h-11 sm:flex-nowrap sm:py-0">
        <AgentIcon agentId={run.agentId} color={run.color} className="h-4 w-4" />
        <span className="truncate text-[13px] font-medium">{run.agentName}</span>
        {model && (
          <span className="min-w-0 truncate font-mono text-[11px] text-white/35" title={run.model ? t('common.specified') : t('common.default')}>
            {model}
          </span>
        )}
        <span className="flex w-full shrink-0 items-center justify-end gap-3 sm:ml-auto sm:w-auto">
          <Metrics metrics={run.metrics} />
          <LikeButton run={run} />
          <span className="font-mono text-[11px] text-white/35 tabular-nums">{elapsed(run)}</span>
          <span className={cn('flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em]', st.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', st.dot)} />
            {t(st.labelKey)}
          </span>
        </span>
      </footer>

      {/* 全屏查看 */}
      <Dialog open={showFull} onOpenChange={setShowFull}>
        <DialogContent className="h-[94vh] w-[96vw] max-w-[1500px] overflow-hidden rounded-lg p-0">
          <div className="flex h-full flex-col">
            <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-white/10 px-4">
              <AgentIcon agentId={run.agentId} color={run.color} className="h-4 w-4" />
              <DialogTitle className="text-[13px] font-medium">{run.agentName}</DialogTitle>
              {model && <span className="font-mono text-[11px] text-white/35">{model}</span>}
              <span className="font-mono text-[11px] text-white/25">/ {run.project}</span>
              <div className="ml-auto flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="font-mono text-[10px] tracking-wider uppercase" onClick={() => window.open(previewUrl, '_blank')}>
                  <ExternalLink className="h-3 w-3" /> {t('common.open')}
                </Button>
                <DialogClose asChild>
                  <Button variant="ghost" size="icon">
                    <X className="h-4 w-4" />
                  </Button>
                </DialogClose>
              </div>
            </header>
            {previewUrl && (
              <iframe
                src={previewUrl}
                title={`${run.folder}-full`}
                sandbox="allow-scripts allow-modals allow-pointer-lock allow-popups allow-downloads"
                referrerPolicy="no-referrer"
                className="w-full flex-1 border-0 bg-black"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </article>
  )
}
