import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Loader2,
  Maximize2,
  RotateCw,
  ExternalLink,
  Trash2,
  Square,
  Terminal,
  X,
  FolderClosed,
} from 'lucide-react'

const STATUS_META = {
  pending: { text: '排队中', cls: 'border-white/20 text-white/50' },
  running: { text: '运行中', cls: 'border-amber-300/50 bg-amber-300/10 text-amber-300' },
  done: { text: '完成', cls: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' },
  failed: { text: '失败', cls: 'border-rose-400/40 bg-rose-400/10 text-rose-300' },
  stopped: { text: '已停止', cls: 'border-white/20 text-white/50' },
  interrupted: { text: '已中断', cls: 'border-rose-400/30 text-rose-300/70' },
}

// 虚拟视口：作品按桌面尺寸渲染后整体缩放，保证内容完整可见
const VIEW_W = 1280
const VIEW_H = 800

function elapsed(run) {
  if (!run.startedAt) return ''
  const end = run.endedAt ? new Date(run.endedAt) : new Date()
  const sec = Math.max(0, Math.round((end - new Date(run.startedAt)) / 1000))
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m${sec % 60}s`
}

function previewUrlOf(run) {
  if (!run.entry) return null
  const folderPath = run.folder.split('/').map(encodeURIComponent).join('/')
  return `/workspace/${folderPath}/${run.entry}`
}

const btnCls =
  'flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1.5 text-xs text-white/70 transition hover:border-white/35 hover:text-white'

function ModelTag({ run }) {
  const m = run.model || run.resolvedModel
  if (!m) return null
  return (
    <span
      className="max-w-[160px] overflow-hidden rounded-full border border-white/10 bg-white/[0.04] px-2 py-px text-[11px] font-normal text-ellipsis whitespace-nowrap text-white/50"
      title={run.model ? `指定模型 ${m}` : `默认模型 ${m}`}
    >
      {m}
    </span>
  )
}

function ScaledPreview({ url, frameKey, onClick }) {
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
    <div
      ref={boxRef}
      onClick={onClick}
      className="group relative h-full w-full cursor-zoom-in overflow-hidden"
      title="点击全屏查看"
    >
      {scale > 0 && (
        <iframe
          key={frameKey}
          src={url}
          title={url}
          loading="lazy"
          className="pointer-events-none origin-top-left border-0 bg-black"
          style={{ width: VIEW_W, height: VIEW_H, transform: `scale(${scale})` }}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
        <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-1.5 text-xs text-white backdrop-blur">
          <Maximize2 className="h-3.5 w-3.5" /> 全屏查看
        </span>
      </div>
    </div>
  )
}

function FullscreenModal({ run, url, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="glass-deep flex h-full w-full max-w-[1480px] flex-col overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: run.color }} />
          <span className="flex items-baseline gap-2 text-sm font-semibold">
            {run.agentName}
            <ModelTag run={run} />
          </span>
          <span className="text-xs text-white/40">{run.project}</span>
          <div className="ml-auto flex items-center gap-2">
            <a href={url} target="_blank" rel="noreferrer" className={btnCls}>
              <ExternalLink className="h-3.5 w-3.5" /> 新窗口
            </a>
            <button onClick={onClose} className={btnCls}>
              <X className="h-3.5 w-3.5" /> 关闭
            </button>
          </div>
        </header>
        <iframe src={url} title={`${run.folder}-full`} className="w-full flex-1 border-0 bg-black" />
      </div>
    </div>,
    document.body
  )
}

export default function RunCard({ run, log, onStop, onDelete, onFetchLog }) {
  const [showLog, setShowLog] = useState(false)
  const [showFull, setShowFull] = useState(false)
  const [frameKey, setFrameKey] = useState(0)
  const [, forceTick] = useState(0)
  const logRef = useRef(null)

  const isLive = run.status === 'running' || run.status === 'pending'
  const meta = STATUS_META[run.status] || STATUS_META.pending

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
    if (showLog && log == null) onFetchLog(run.id)
  }, [showLog, log, run.id, onFetchLog])

  useEffect(() => {
    if (showLog && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [showLog, log])

  const previewUrl = previewUrlOf(run)

  return (
    <article
      className={`glass flex flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)] ${
        isLive ? 'border-amber-300/25' : ''
      }`}
    >
      <header className="flex items-center gap-2.5 px-4 py-3">
        <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: run.color }} />
        <span className="flex min-w-0 flex-1 items-baseline gap-2 text-sm font-semibold">
          {run.agentName}
          <ModelTag run={run} />
        </span>
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] ${meta.cls}`}
        >
          {isLive && <Loader2 className="h-3 w-3 animate-spin" />}
          {meta.text}
        </span>
        <span className="shrink-0 text-xs text-white/40 tabular-nums">{elapsed(run)}</span>
      </header>

      <div className="relative aspect-[16/10] bg-black/50">
        {previewUrl ? (
          <ScaledPreview url={previewUrl} frameKey={frameKey} onClick={() => setShowFull(true)} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-white/35">
            {isLive ? (
              <span className="shimmer">生成中，作品出现后自动预览…</span>
            ) : run.status === 'failed' ? (
              run.error || '未产出可预览的作品'
            ) : (
              '暂无可预览的作品'
            )}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 px-4 py-2.5">
        <span
          className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] text-ellipsis whitespace-nowrap text-white/35"
          title={run.folder}
        >
          <FolderClosed className="h-3 w-3 shrink-0" />
          {run.folder}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {previewUrl && (
            <>
              <button onClick={() => setShowFull(true)} className={btnCls} title="全屏查看">
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setFrameKey((k) => k + 1)} className={btnCls} title="重新加载预览">
                <RotateCw className="h-3.5 w-3.5" />
              </button>
              <a href={previewUrl} target="_blank" rel="noreferrer" className={btnCls} title="新窗口打开">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          )}
          <button
            onClick={() => setShowLog((s) => !s)}
            className={`${btnCls} ${showLog ? 'border-clay/60 text-clay' : ''}`}
            title="日志"
          >
            <Terminal className="h-3.5 w-3.5" />
          </button>
          {isLive ? (
            <button
              onClick={() => onStop(run.id)}
              className={`${btnCls} hover:border-rose-400/60 hover:text-rose-300`}
              title="终止进程"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={() => {
                if (confirm(`删除 ${run.folder} 及其全部文件？`)) onDelete(run.id)
              }}
              className={`${btnCls} hover:border-rose-400/60 hover:text-rose-300`}
              title="删除记录与文件夹"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </footer>

      {showLog && (
        <pre
          ref={logRef}
          className="m-0 max-h-60 overflow-auto border-t border-white/10 bg-black/60 p-3.5 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-white/60"
        >
          {log || '（暂无日志输出）'}
        </pre>
      )}

      {showFull && previewUrl && <FullscreenModal run={run} url={previewUrl} onClose={() => setShowFull(false)} />}
    </article>
  )
}
