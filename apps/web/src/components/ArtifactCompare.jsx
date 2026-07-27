import { useEffect, useMemo, useState } from 'react'
import { AlignLeft, Columns3, FileCode2, Loader2, TriangleAlert } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import AgentIcon from './AgentIcon.jsx'
import ArtifactPreview, { artifactTypeOf } from './ArtifactPreview.jsx'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n.jsx'

function parseSections(markdown) {
  const sections = []
  let current = { title: 'Overview', level: 1, content: [] }
  for (const line of String(markdown || '').split(/\r?\n/)) {
    const heading = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/)
    if (heading) {
      if (current.content.some((item) => item.trim())) sections.push({ ...current, content: current.content.join('\n').trim() })
      current = { title: heading[2].trim(), level: heading[1].length, content: [] }
    } else {
      current.content.push(line)
    }
  }
  if (current.content.some((item) => item.trim()) || !sections.length) {
    sections.push({ ...current, content: current.content.join('\n').trim() })
  }
  return sections
}

const sectionKey = (title) =>
  String(title || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s`*_#：:、，,。.()[\]【】/-]+/g, '')

function MarkdownBody({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children: content }) => <h1 className="mb-3 mt-5 text-xl font-semibold text-white">{content}</h1>,
        h2: ({ children: content }) => <h2 className="mb-2 mt-4 text-base font-semibold text-white">{content}</h2>,
        h3: ({ children: content }) => <h3 className="mb-2 mt-4 text-sm font-semibold text-white/90">{content}</h3>,
        p: ({ children: content }) => <p className="my-2">{content}</p>,
        ul: ({ children: content }) => <ul className="my-2 list-disc space-y-1 pl-5">{content}</ul>,
        ol: ({ children: content }) => <ol className="my-2 list-decimal space-y-1 pl-5">{content}</ol>,
        blockquote: ({ children: content }) => <blockquote className="my-3 border-l-2 border-acid/40 pl-3 text-white/45">{content}</blockquote>,
        pre: ({ children: content }) => <pre className="my-3 overflow-auto rounded border border-white/10 bg-black/45 p-3 font-mono text-[11px] leading-5">{content}</pre>,
        code: ({ className, children: content, ...props }) =>
          className ? <code className={className} {...props}>{content}</code> : <code className="rounded bg-white/8 px-1 py-0.5 font-mono text-[0.9em]" {...props}>{content}</code>,
        table: ({ children: content }) => <div className="my-3 overflow-auto"><table className="w-full border-collapse text-left text-[11px]">{content}</table></div>,
        th: ({ children: content }) => <th className="border border-white/12 bg-white/5 px-2 py-1.5 text-white/75">{content}</th>,
        td: ({ children: content }) => <td className="border border-white/10 px-2 py-1.5 text-white/55">{content}</td>,
      }}
    >
      {children || ''}
    </ReactMarkdown>
  )
}
function RunHeader({ run }) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-white/10 bg-[#0c0c0f] px-3 py-2.5">
      <AgentIcon agentId={run.agentId} color={run.color} className="h-3.5 w-3.5" />
      <span className="truncate text-xs font-medium text-white/80">{run.agentName}</span>
      {(run.model || run.resolvedModel) && (
        <span className="min-w-0 truncate font-mono text-[9px] text-white/30">{run.model || run.resolvedModel}</span>
      )}
    </div>
  )
}

export default function ArtifactCompare({ runs }) {
  const { t } = useI18n()
  const renderableRuns = useMemo(() => runs.filter((run) => run.entry), [runs])
  const allMarkdown =
    renderableRuns.length > 0 && renderableRuns.every((run) => artifactTypeOf(run) === 'markdown')
  const [mode, setMode] = useState('aligned')
  const [documents, setDocuments] = useState({})

  useEffect(() => {
    if (!allMarkdown) return
    const controllers = []
    let active = true
    setDocuments({})
    for (const run of renderableRuns) {
      const controller = new AbortController()
      controllers.push(controller)
      fetch(`/api/runs/${run.id}/artifact`, { signal: controller.signal })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(data.error || 'Failed to load Markdown')
          if (active) setDocuments((current) => ({ ...current, [run.id]: { content: data.content || '', error: '' } }))
        })
        .catch((error) => {
          if (active && error.name !== 'AbortError') {
            setDocuments((current) => ({ ...current, [run.id]: { content: '', error: error.message } }))
          }
        })
    }
    return () => {
      active = false
      controllers.forEach((controller) => controller.abort())
    }
  }, [allMarkdown, renderableRuns])

  const parsed = useMemo(
    () =>
      Object.fromEntries(
        renderableRuns.map((run) => [
          run.id,
          parseSections(documents[run.id]?.content || ''),
        ])
      ),
    [documents, renderableRuns]
  )

  const alignedSections = useMemo(() => {
    const ordered = []
    const seen = new Set()
    for (const run of renderableRuns) {
      for (const section of parsed[run.id] || []) {
        const key = sectionKey(section.title) || `section-${ordered.length}`
        if (seen.has(key)) continue
        seen.add(key)
        ordered.push({ key, title: section.title })
      }
    }
    return ordered
  }, [parsed, renderableRuns])

  if (!renderableRuns.length) {
    return (
      <div className="rounded-lg border border-dashed border-white/12 py-20 text-center font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
        {t('project.compareWaiting')}
      </div>
    )
  }

  if (!allMarkdown) {
    return (
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(renderableRuns.length, 3)}, minmax(0, 1fr))` }}>
        {renderableRuns.map((run) => (
          <section key={run.id} className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-black">
            <RunHeader run={run} />
            <div className="aspect-[16/10]">
              <ArtifactPreview run={run} compact={false} />
            </div>
          </section>
        ))}
      </div>
    )
  }

  const loading = renderableRuns.some((run) => documents[run.id] == null)
  const modes = [
    ['aligned', Columns3, t('project.compareAligned')],
    ['document', AlignLeft, t('project.compareDocuments')],
    ['raw', FileCode2, t('project.compareRaw')],
  ]

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        {modes.map(([value, Icon, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[9px] tracking-[0.1em] uppercase',
              mode === value ? 'border-acid bg-acid text-black' : 'border-white/12 text-white/40 hover:text-white'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white/25" /></div>
      ) : mode === 'aligned' ? (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <div
            className="grid min-w-[720px] bg-[#0c0c0f]"
            style={{ gridTemplateColumns: `repeat(${renderableRuns.length}, minmax(260px, 1fr))` }}
          >
            {renderableRuns.map((run) => <RunHeader key={run.id} run={run} />)}
            {alignedSections.map((section) => (
              <div key={section.key} className="contents">
                <h2
                  className="border-y border-white/10 bg-white/[0.035] px-3 py-2 font-mono text-[10px] tracking-[0.12em] text-white/55 uppercase"
                  style={{ gridColumn: `1 / span ${renderableRuns.length}` }}
                >
                  {section.title}
                </h2>
                {renderableRuns.map((run) => {
                  const item = (parsed[run.id] || []).find((candidate) => sectionKey(candidate.title) === section.key)
                  return (
                    <div key={`${section.key}-${run.id}`} className="min-h-24 border-r border-white/8 px-4 py-3 text-[12px] leading-6 text-white/65 last:border-r-0">
                      {documents[run.id]?.error ? (
                        <p className="flex items-center gap-2 text-red-300"><TriangleAlert className="h-3.5 w-3.5" />{documents[run.id].error}</p>
                      ) : item?.content ? (
                        <MarkdownBody>{item.content}</MarkdownBody>
                      ) : (
                        <span className="font-mono text-[9px] text-white/20 uppercase">{t('project.compareMissingSection')}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${Math.min(renderableRuns.length, 3)}, minmax(0, 1fr))` }}
        >
          {renderableRuns.map((run) => (
            <section key={run.id} className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0f]">
              <RunHeader run={run} />
              <div className="max-h-[70vh] overflow-auto p-4 text-[12px] leading-6 text-white/65">
                {mode === 'raw' ? (
                  <pre className="whitespace-pre-wrap font-mono text-[10px] leading-5 text-white/55">{documents[run.id]?.content}</pre>
                ) : (
                  <MarkdownBody>{documents[run.id]?.content}</MarkdownBody>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
