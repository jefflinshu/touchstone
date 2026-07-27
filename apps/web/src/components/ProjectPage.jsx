import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Eye,
  Folder,
  MessageCircleQuestion,
  Share2,
} from 'lucide-react'
import RunCard from './RunCard.jsx'
import AgentIcon from './AgentIcon.jsx'
import ArtifactCompare from './ArtifactCompare.jsx'
import { QuestionBlock } from './AgentActivity.jsx'
import { ProjectLikeButton, CategoryTag } from './ProjectCard.jsx'
import PreviewImage from './PreviewImage.jsx'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n.jsx'

// 推荐小卡：只有缩略图+名字，整卡一个点击
function MiniProjectCard({ group: g, onOpen }) {
  const previewRun = g.runs.find((r) => r.preview && r.status === 'done') || g.runs.find((r) => r.preview)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-[180px] shrink-0 cursor-pointer overflow-hidden rounded-md border border-white/10 bg-[#0c0c0f] text-left transition-colors hover:border-white/35"
    >
      <div className="aspect-[16/10] overflow-hidden border-b border-white/8 bg-black">
        {previewRun ? (
          <PreviewImage
            src={`/api/runs/${previewRun.id}/preview`}
            alt=""
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Folder className="h-4 w-4 text-white/15" />
          </div>
        )}
      </div>
      <div className="truncate px-2.5 py-2 text-xs font-medium text-white/80 group-hover:text-white">
        {g.project}
      </div>
    </button>
  )
}

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

export default function ProjectPage({
  project,
  runs,
  logs,
  activities,
  likes,
  category,
  prevProject,
  nextProject,
  recos = [],
  onOpenProject,
  onBack,
  onStop,
  onDelete,
  onFetchActivity,
  currentUser,
}) {
  const { t, language } = useI18n()
  const [layout, setLayout] = useState('2')
  const [hidden, setHidden] = useState(() => new Set())
  const [activeView, setActiveView] = useState('results')
  const activityRequests = useRef(new Set())

  useEffect(() => {
    setActiveView('results')
    setHidden(new Set())
    activityRequests.current.clear()
  }, [project])

  useEffect(() => {
    if (viewedProjects.has(project)) return
    viewedProjects.add(project)
    fetch(`/api/projects/${encodeURIComponent(project)}/view`, { method: 'POST' }).catch(() => {})
  }, [project])

  // 方向键在项目之间左右切换（输入框聚焦时不响应）
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowLeft' && prevProject) onOpenProject?.(prevProject)
      if (e.key === 'ArrowRight' && nextProject) onOpenProject?.(nextProject)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevProject, nextProject, onOpenProject])
  const [promptCopied, copyPrompt] = useCopy()
  const [linkCopied, copyLink] = useCopy()

  const latest = runs[runs.length - 1]
  const prompt = latest?.prompt || ''

  const visibleRuns = useMemo(() => runs.filter((r) => !hidden.has(r.id)), [runs, hidden])
  const activityRuns = useMemo(
    () => visibleRuns.filter((run) => currentUser && run.user === currentUser),
    [currentUser, visibleRuns]
  )
  const pendingRequests = useMemo(
    () =>
      runs.flatMap((run) => {
        if (
          !currentUser ||
          run.user !== currentUser ||
          (run.status !== 'running' && run.status !== 'pending')
        ) {
          return []
        }
        return (activities[run.id] || [])
          .filter((event) => event.kind === 'question' && event.status !== 'answered')
          .map((event) => ({ run, event }))
      }),
    [activities, currentUser, runs]
  )

  useEffect(() => {
    if (!currentUser) return
    for (const run of runs) {
      if (
        run.user === currentUser &&
        activities[run.id] == null &&
        !activityRequests.current.has(run.id)
      ) {
        activityRequests.current.add(run.id)
        Promise.resolve(onFetchActivity(run.id)).catch(() => activityRequests.current.delete(run.id))
      }
    }
  }, [activities, currentUser, onFetchActivity, runs])

  const gridStyle =
    layout === 'auto'
      ? { gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))' }
      : { gridTemplateColumns: `repeat(${layout}, minmax(0, 1fr))` }

  return (
    <div className="mt-5 sm:mt-6">
      <div className="mb-5 flex flex-wrap items-center gap-2.5 sm:gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="font-mono text-[10px] tracking-[0.15em] uppercase">
          <ArrowLeft className="h-3 w-3" /> {t('common.back')}
        </Button>
        <h1 className="min-w-0 flex-1 truncate font-pixel text-lg sm:text-xl">{project}</h1>
        <CategoryTag category={category} />
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <div className="hidden overflow-hidden rounded-md border border-white/12 sm:flex">
            {LAYOUTS.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLayout(l.key)}
                className={cn(
                  'cursor-pointer px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors',
                  layout === l.key ? 'bg-acid text-black' : 'text-white/45 hover:text-white'
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-md border border-white/12">
            <button
              type="button"
              title={t('project.prev')}
              disabled={!prevProject}
              onClick={() => onOpenProject?.(prevProject)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center text-white/60 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-default disabled:opacity-25"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="w-px bg-white/10" />
            <button
              type="button"
              title={t('project.next')}
              disabled={!nextProject}
              onClick={() => onOpenProject?.(nextProject)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center text-white/60 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-default disabled:opacity-25"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <ProjectLikeButton project={project} likes={likes} className="px-1.5" />
          <Button
            variant="outline"
            size="sm"
            className="ml-auto font-mono text-[10px] tracking-[0.15em] uppercase sm:ml-0"
            onClick={() => copyLink(location.href)}
          >
            {linkCopied ? <Check className="h-3 w-3 text-acid" /> : <Share2 className="h-3 w-3" />}
            {linkCopied ? t('common.copied') : t('common.share')}
          </Button>
        </div>
      </div>

      {/* 主内容撑满首屏，推荐区需轻微滚动才出现，不挤占 showcase 空间 */}
      <div className="flex min-h-[calc(100vh-180px)] flex-col gap-6 lg:flex-row">
        {/* 左侧：提示词 */}
        <aside className="w-full shrink-0 lg:w-[300px]">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] lg:sticky lg:top-20">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
              <span className="font-mono text-[10px] tracking-[0.2em] text-white/35 uppercase">{t('common.prompt')}</span>
              <button
                type="button"
                onClick={() => copyPrompt(prompt)}
                className="flex cursor-pointer items-center gap-1 font-mono text-[10px] tracking-wider text-white/45 uppercase transition-colors hover:text-white"
              >
                {promptCopied ? <Check className="h-3 w-3 text-acid" /> : <Copy className="h-3 w-3" />}
                {promptCopied ? t('common.copied') : t('common.copy')}
              </button>
            </div>
            <p className="max-h-[50vh] overflow-auto px-4 py-3.5 text-[13px] leading-6 whitespace-pre-wrap text-white/75">
              {prompt}
            </p>
            <div className="border-t border-white/8 px-4 py-3 font-mono text-[10px] leading-5 tracking-wider text-white/30 uppercase">
              {latest && <div>{t('common.created')} {new Date(latest.createdAt).toLocaleString(language)}</div>}
              <div>{t('project.agentsRuns', { agents: new Set(runs.map((r) => r.agentName)).size, runs: runs.length })}</div>
            </div>
          </div>
        </aside>

        {/* 右侧：作品宫格 */}
        <main className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-2">
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
                  <AgentIcon agentId={r.agentId} color={r.color} className={cn('h-3 w-3', !on && 'opacity-30')} />
                  {r.agentName}
                  {r.providerName && <span className="text-sky-300/55">{r.providerName}</span>}
                  {(r.model || r.resolvedModel) && <span className="text-white/40">{r.model || r.resolvedModel}</span>}
                </button>
              )
            })}
          </div>

          {pendingRequests.length > 0 && (
            <section className="mb-4 overflow-hidden rounded-lg border border-amber-300/25 bg-amber-300/[0.035]">
              <header className="flex items-center gap-2 border-b border-amber-300/15 px-3.5 py-2.5">
                <MessageCircleQuestion className="h-4 w-4 text-amber-300" />
                <h2 className="text-xs font-medium text-amber-100/85">{t('project.needsAttention')}</h2>
                <span className="rounded-full bg-amber-300 px-1.5 font-mono text-[9px] font-semibold text-black">
                  {pendingRequests.length}
                </span>
              </header>
              <div className="grid gap-3 p-3 md:grid-cols-2">
                {pendingRequests.map(({ run, event }) => (
                  <div key={`${run.id}-${event.id}`} className="min-w-0">
                    <div className="mb-1.5 flex items-center gap-1.5 px-1">
                      <AgentIcon agentId={run.agentId} color={run.color} className="h-3 w-3" />
                      <span className="text-[10px] text-white/50">{run.agentName}</span>
                      {(run.model || run.resolvedModel) && (
                        <span className="truncate font-mono text-[9px] text-white/25">{run.model || run.resolvedModel}</span>
                      )}
                    </div>
                    <QuestionBlock event={event} run={run} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mb-4 flex items-center gap-1.5 border-b border-white/10 pb-2">
            {[
              ['results', Eye, t('project.viewResults')],
              ['compare', Columns3, t('project.viewCompare')],
              ['activity', Activity, t('project.viewActivity')],
            ].map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveView(value)}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[9px] tracking-[0.12em] uppercase transition-colors',
                  activeView === value
                    ? 'border-acid bg-acid text-black'
                    : 'border-transparent text-white/35 hover:border-white/12 hover:text-white/75'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {value === 'activity' && pendingRequests.length > 0 && (
                  <span className={cn('rounded-full px-1 text-[8px]', activeView === value ? 'bg-black/15' : 'bg-amber-300 text-black')}>
                    {pendingRequests.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeView === 'compare' ? (
            <ArtifactCompare runs={visibleRuns} />
          ) : (
            <div className="grid gap-4" style={gridStyle}>
              {(activeView === 'activity' ? activityRuns : visibleRuns).map((run) => (
                <RunCard
                  key={run.id}
                  run={run}
                  log={logs[run.id]}
                  events={activities[run.id]}
                  onStop={onStop}
                  onDelete={onDelete}
                  onFetchActivity={onFetchActivity}
                  forceView={activeView === 'activity' ? 'activity' : 'preview'}
                />
              ))}
            </div>
          )}
          {activeView === 'activity' && activityRuns.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/12 py-16 text-center font-mono text-xs tracking-[0.15em] text-white/30 uppercase">
              {t('project.activityPrivate')}
            </div>
          )}
          {activeView === 'results' && visibleRuns.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/12 py-16 text-center font-mono text-xs tracking-[0.2em] text-white/30 uppercase">
              {t('project.allHidden')}
            </div>
          )}
        </main>
      </div>

      {/* 推荐：同分类优先 → 热度 → 最新 */}
      {recos.length > 0 && (
        <div className="mt-12">
          <div className="mb-3 flex items-center gap-4 font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
            <span>{t('project.moreLikeThis')}</span>
            <span className="h-px flex-1 bg-white/8" />
          </div>
          <div className="flex flex-wrap gap-3">
            {recos.map((g) => (
              <MiniProjectCard key={g.project} group={g} onOpen={() => onOpenProject?.(g.project)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
