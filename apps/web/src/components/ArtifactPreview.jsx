import { useEffect, useRef, useState } from 'react'
import { FileText, Loader2, TriangleAlert } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const VIEW_W = 1280
const VIEW_H = 800

export function artifactTypeOf(run) {
  if (run.artifactType) return run.artifactType
  const extension = String(run.entry || '').split('.').pop()?.toLowerCase()
  if (extension === 'svg') return 'svg'
  if (extension === 'md' || extension === 'markdown') return 'markdown'
  return 'html'
}

export function artifactUrlOf(run) {
  if (!run.entry) return null
  const folderPath = run.folder.split('/').map(encodeURIComponent).join('/')
  const entryPath = run.entry.split('/').map(encodeURIComponent).join('/')
  return `/workspace/${folderPath}/${entryPath}`
}

function MarkdownDocument({ content, compact }) {
  return (
    <article
      className={
        compact
          ? 'mx-auto min-h-full max-w-3xl bg-[#111114] px-8 py-7 text-[17px] leading-7 text-white/75'
          : 'mx-auto min-h-full max-w-4xl px-8 py-10 text-[15px] leading-7 text-white/75 sm:px-12'
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="text-acid underline underline-offset-2">{children}</a>,
          h1: ({ children }) => <h1 className="mb-5 border-b border-white/10 pb-4 text-3xl font-semibold tracking-tight text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-3 mt-8 text-xl font-semibold text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-6 text-base font-semibold text-white/90">{children}</h3>,
          p: ({ children }) => <p className="my-3">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
          blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-acid/45 pl-4 text-white/50">{children}</blockquote>,
          pre: ({ children }) => <pre className="my-4 overflow-auto rounded-md border border-white/10 bg-black/55 p-4 font-mono text-[12px] leading-6 text-white/65">{children}</pre>,
          code: ({ className, children, ...props }) =>
            className ? <code className={className} {...props}>{children}</code> : <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[0.9em] text-white/85" {...props}>{children}</code>,
          table: ({ children }) => <div className="my-4 overflow-auto"><table className="w-full border-collapse text-left text-[13px]">{children}</table></div>,
          th: ({ children }) => <th className="border border-white/12 bg-white/5 px-3 py-2 text-white/80">{children}</th>,
          td: ({ children }) => <td className="border border-white/10 px-3 py-2 text-white/60">{children}</td>,
          hr: () => <hr className="my-7 border-white/10" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  )
}

function MarkdownPreview({ run, frameKey, compact }) {
  const [state, setState] = useState({ loading: true, content: '', error: '' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: true, content: '', error: '' })
    fetch(`/api/runs/${run.id}/artifact`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Failed to load Markdown')
        setState({ loading: false, content: data.content || '', error: '' })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ loading: false, content: '', error: error.message })
      })
    return () => controller.abort()
  }, [run.id, run.entry, frameKey])

  if (state.loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white/25" /></div>
  }
  if (state.error) {
    return <div className="flex h-full items-center justify-center gap-2 px-6 text-xs text-red-300"><TriangleAlert className="h-4 w-4" />{state.error}</div>
  }
  return (
    <div className={compact ? 'absolute inset-0 overflow-hidden bg-[#111114] pointer-events-none' : 'h-full overflow-auto bg-[#111114]'}>
      <MarkdownDocument content={state.content} compact={compact} />
    </div>
  )
}

function ScaledHtmlPreview({ url, frameKey }) {
  const boxRef = useRef(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const element = boxRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setScale(element.clientWidth / VIEW_W))
    observer.observe(element)
    setScale(element.clientWidth / VIEW_W)
    return () => observer.disconnect()
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

export default function ArtifactPreview({ run, frameKey, compact = true }) {
  const type = artifactTypeOf(run)
  const url = artifactUrlOf(run)
  if (!url) return null

  if (type === 'markdown') return <MarkdownPreview run={run} frameKey={frameKey} compact={compact} />
  if (type === 'svg') {
    return (
      <div className={compact ? 'absolute inset-0 flex items-center justify-center overflow-hidden bg-white/[0.03] p-5' : 'flex h-full items-center justify-center overflow-auto bg-[#111114] p-8'}>
        <img key={frameKey} src={url} alt={run.project || run.entry} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }
  if (compact) return <ScaledHtmlPreview url={url} frameKey={frameKey} />
  return (
    <iframe
      key={frameKey}
      src={url}
      title={`${run.folder}-full`}
      sandbox="allow-scripts allow-modals allow-pointer-lock allow-popups allow-downloads"
      referrerPolicy="no-referrer"
      className="h-full w-full border-0 bg-black"
    />
  )
}

