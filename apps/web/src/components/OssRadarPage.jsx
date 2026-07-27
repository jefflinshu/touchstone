import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Bookmark,
  CalendarDays,
  ExternalLink,
  GitFork,
  ImageOff,
  Loader2,
  MessageCircle,
  Search,
  Star,
  Tags,
} from 'lucide-react'
import { OSS_RADAR_REPOS, xSearchUrl } from '@/lib/ossRadarData'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'
import { useI18n } from '@/i18n.jsx'

const CATEGORY_ORDER = [
  'ai-agents',
  'workflow',
  'skills',
  'context',
  'mcp',
  'devtools',
  'security',
  'sandboxes',
  'evals',
  'ide',
  'workspace',
  'observability',
  'qa',
  'knowledge',
  'media-tools',
  'backend',
  'hardware',
  'memory',
  'learning',
]

const SORT_OPTIONS = [
  { key: 'stars', labelKey: 'oss.sort.stars' },
  { key: 'recent', labelKey: 'oss.sort.recent' },
  { key: 'issues', labelKey: 'oss.sort.issues' },
]

const INITIAL_PRIORITY_IMAGES = 6
const TRANSLATION_BATCH_SIZE = 12

function GitHubMark({ className }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

function n(num) {
  const value = Number(num || 0)
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `${Math.round(value / 100) / 10}k`
  return value.toLocaleString()
}

function compactDate(value, language) {
  if (!value) return ''
  return new Date(value).toLocaleDateString(language, { month: 'short', day: 'numeric' })
}

function categoryLabel(t, key) {
  const label = t(`oss.category.${key}`)
  return label === `oss.category.${key}` ? key : label
}

function sortValue(item, sortKey) {
  if (sortKey === 'recent') return Date.parse(item.pushedAt || '') || 0
  return Number(item[sortKey] || 0)
}

function compareRepos(a, b, sortKey, direction) {
  const dir = direction === 'asc' ? 1 : -1
  const diff = sortValue(a, sortKey) - sortValue(b, sortKey)
  if (diff !== 0) return diff * dir
  return Number(b.stars || 0) - Number(a.stars || 0)
}

function chunkList(list, size) {
  const out = []
  for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size))
  return out
}

function repoOwner(item) {
  return String(item.repo || '').split('/')[0] || item.name || ''
}

function repoCoverUrl(item) {
  return item.coverUrl || `https://opengraph.githubassets.com/touchstone-oss-radar/${item.repo}`
}

function repoAvatarUrl(item) {
  return item.avatarUrl || `https://github.com/${repoOwner(item)}.png?size=80`
}

function localizedRepoCopy(item, translation) {
  return {
    title: translation?.title?.trim() || item.name,
    summary: translation?.summary?.trim() || item.description,
  }
}

function MediaPlaceholder({ label }) {
  const { t } = useI18n()
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#111113] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.09)_1px,transparent_0)] bg-[length:18px_18px]">
      <div className="flex flex-col items-center gap-2 px-4 text-center text-white/36">
        <ImageOff className="h-6 w-6 text-white/30" />
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase">{label || t('fable.noPreview')}</span>
      </div>
    </div>
  )
}

function MediaLoadingOverlay() {
  const { t } = useI18n()
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0d0d10]">
      <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,rgba(255,255,255,0.04),rgba(255,255,255,0.10),rgba(255,255,255,0.04))]" />
      <div className="absolute inset-y-0 -left-1/3 w-1/2 animate-[pulse_1.6s_ease-in-out_infinite] bg-white/10 blur-2xl" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] text-white/55 uppercase shadow-lg backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-acid" />
          {t('fable.loadingCover')}
        </div>
      </div>
    </div>
  )
}

function MediaBlock({ item, priority = false, className }) {
  const { t } = useI18n()
  const [imageFailed, setImageFailed] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const imageUrl = repoCoverUrl(item)

  return (
    <div className={cn('relative h-[180px] shrink-0 overflow-hidden bg-black sm:h-[210px]', className)}>
      {imageUrl && !imageFailed ? (
        <>
          {!imageLoaded && <MediaLoadingOverlay />}
          <img
            src={imageUrl}
            alt={`${item.name} GitHub preview`}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchpriority={priority ? 'high' : 'auto'}
            className={cn(
              'h-full w-full object-contain transition duration-300 hover:scale-[1.02]',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
          />
        </>
      ) : (
        <MediaPlaceholder label={t('fable.noPreview')} />
      )}
      <a href={item.url} target="_blank" rel="noreferrer" className="absolute inset-0" aria-label={item.repo} />
    </div>
  )
}

function RepoCard({ item, index, language, translation }) {
  const { t } = useI18n()
  const [avatarFailed, setAvatarFailed] = useState(false)
  const xUrl = xSearchUrl(item.xKeywords)
  const pushedLabel = compactDate(item.pushedAt, language)
  const owner = repoOwner(item)
  const copy = localizedRepoCopy(item, translation)
  return (
    <article
      className="flex flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0f] transition-colors hover:border-white/25 sm:h-[460px]"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '420px' }}
    >
      <MediaBlock item={item} priority={index < INITIAL_PRIORITY_IMAGES} className="hidden sm:block" />

      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-4">
        <div className="flex min-h-10 shrink-0 items-start gap-3">
          <a href={item.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2.5">
              {repoAvatarUrl(item) && !avatarFailed ? (
                <img
                  src={repoAvatarUrl(item)}
                  alt={owner}
                  loading="lazy"
                  decoding="async"
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/55">
                  <GitHubMark className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{owner}</div>
                <div className="mt-0.5 truncate font-mono text-[10px] tracking-[0.12em] text-white/35 uppercase">{item.language} · {item.license}</div>
              </div>
            </div>
          </a>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            title="GitHub"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/40 transition-colors hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {pushedLabel && (
          <div className="mt-2 flex h-5 shrink-0 items-center">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded border border-white/10 bg-white/[0.03] px-2 font-mono text-[10px] tracking-[0.08em] text-white/45 uppercase">
              <CalendarDays className="h-3 w-3 shrink-0 text-white/35" />
              <span className="truncate">{t('oss.updatedShort', { date: pushedLabel })}</span>
            </span>
          </div>
        )}

        <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 block shrink-0 overflow-hidden sm:mt-2 sm:h-[104px]">
          <h2 className="line-clamp-2 text-[19px] leading-7 font-semibold text-white/90 sm:text-[15px] sm:leading-6 sm:font-medium">{copy.title}</h2>
          <p className="mt-1 line-clamp-3 text-[13px] leading-5 text-white/55">{copy.summary}</p>
        </a>

        <div className="mt-3 flex min-h-7 shrink-0 items-start gap-2">
          <a
            href={xUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent('oss_radar_open_x', { repo: item.repo })}
            className="inline-flex h-6 min-w-0 shrink-0 cursor-pointer items-center gap-1 rounded border border-emerald-400/25 bg-emerald-400/5 px-2 font-mono text-[10px] tracking-[0.12em] text-emerald-300 uppercase"
          >
            <Search className="h-3 w-3" />
            {t('oss.label.keywords')}
          </a>
          <span className="min-w-0 truncate font-mono text-[10px] leading-6 text-white/35">{item.xKeywords.join(' · ')}</span>
        </div>

        <div className="mt-2 flex max-h-14 shrink-0 flex-wrap gap-1.5 overflow-hidden sm:h-7">
          {[item.language, item.license, ...item.tags.slice(0, 3)].filter(Boolean).map((tag) => (
            <span key={tag} className="inline-flex h-6 max-w-full items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-2 font-mono text-[10px] tracking-[0.08em] text-white/42">
              <Tags className="h-3 w-3 shrink-0 text-white/30" />
              <span className="truncate">{tag}</span>
            </span>
          ))}
        </div>

        <div className="mt-4 flex shrink-0 items-center gap-3 border-t border-white/8 pt-3 font-mono text-[10px] text-white/35 sm:mt-auto sm:gap-4">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            {n(item.stars)}
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="h-3 w-3" />
            {n(item.forks)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {n(item.issues)}
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Bookmark className="h-3 w-3" />
            {item.language || t('common.showcase')}
          </span>
        </div>
      </div>
    </article>
  )
}

export default function OssRadarPage({ onBack }) {
  const { t, language } = useI18n()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sortKey, setSortKey] = useState('stars')
  const [sortDirection, setSortDirection] = useState('desc')
  const [translationsByLanguage, setTranslationsByLanguage] = useState({})
  const translationsByLanguageRef = useRef({})
  const translationInflight = useRef(new Set())
  const publishedRepos = useMemo(() => OSS_RADAR_REPOS.filter((item) => item.decision === 'include'), [])

  const categories = useMemo(() => {
    const counts = new Map()
    for (const repo of publishedRepos) {
      for (const key of repo.categories || []) counts.set(key, (counts.get(key) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a[0])
      const bi = CATEGORY_ORDER.indexOf(b[0])
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      return b[1] - a[1]
    })
  }, [publishedRepos])

  useEffect(() => {
    translationsByLanguageRef.current = translationsByLanguage
  }, [translationsByLanguage])

  useEffect(() => {
    if (!publishedRepos.length) return undefined
    let cancelled = false
    const controllers = []
    const languageTranslations = translationsByLanguageRef.current[language] || {}
    const pendingItems = publishedRepos
      .map((item) => ({
        id: item.id,
        title: item.name || '',
        summary: item.description || '',
      }))
      .filter((item) => item.id && (item.title || item.summary))
      .filter((item) => !languageTranslations[item.id] && !translationInflight.current.has(`${language}:${item.id}`))

    if (!pendingItems.length) return undefined

    ;(async () => {
      for (const batch of chunkList(pendingItems, TRANSLATION_BATCH_SIZE)) {
        if (cancelled) break
        const keys = batch.map((item) => `${language}:${item.id}`)
        keys.forEach((key) => translationInflight.current.add(key))
        const controller = new AbortController()
        controllers.push(controller)
        try {
          const res = await fetch('/api/fable5/translations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({ language, items: batch }),
          })
          if (!res.ok) throw new Error(`translation HTTP ${res.status}`)
          const data = await res.json()
          if (cancelled) break
          setTranslationsByLanguage((current) => {
            const next = {
              ...current,
              [language]: { ...(current[language] || {}), ...(data.translations || {}) },
            }
            translationsByLanguageRef.current = next
            return next
          })
        } catch (err) {
          if (!(cancelled || err?.name === 'AbortError')) console.error('[oss radar translation] failed:', err)
        } finally {
          keys.forEach((key) => translationInflight.current.delete(key))
        }
      }
    })()

    return () => {
      cancelled = true
      controllers.forEach((controller) => controller.abort())
    }
  }, [publishedRepos, language])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const languageTranslations = translationsByLanguage[language] || {}
    let list = publishedRepos
    if (category !== 'all') list = list.filter((item) => item.categories?.includes(category))
    if (q) {
      list = list.filter((item) =>
        `${item.name} ${item.repo} ${item.description} ${languageTranslations[item.id]?.title || ''} ${languageTranslations[item.id]?.summary || ''} ${item.language} ${item.license} ${(item.categories || []).join(' ')} ${(item.tags || []).join(' ')} ${(item.xKeywords || []).join(' ')}`
          .toLowerCase()
          .includes(q)
      )
    }
    return [...list].sort((a, b) => compareRepos(a, b, sortKey, sortDirection))
  }, [category, query, sortDirection, sortKey, publishedRepos, language, translationsByLanguage])

  return (
    <main className="pb-20">
      <section className="mt-7 sm:mt-10">
        <h1>
          <button type="button" onClick={onBack} className="cursor-pointer text-left">
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white text-black shadow-[0_0_28px_rgba(255,255,255,0.12)] sm:h-14 sm:w-14">
                <GitHubMark className="h-6 w-6 sm:h-8 sm:w-8" />
              </span>
              <span className="block font-pixel text-[30px] leading-none text-white sm:text-[48px]">OSS RADAR</span>
            </span>
          </button>
        </h1>
      </section>

      <section className="mt-5 sm:mt-6">
        <div className="relative z-10 flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="showcase-control-pill relative flex h-10 w-full items-center rounded-full px-3 text-white transition-colors focus-within:border-acid lg:h-9 lg:flex-1">
            <Search className="pointer-events-none h-3.5 w-3.5 shrink-0 text-white/45" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('oss.searchPlaceholder')}
              className="h-full min-w-0 flex-1 bg-transparent pl-2 text-sm text-white outline-none placeholder:text-white/42"
            />
          </label>
          <div className="grid grid-cols-[minmax(0,1.08fr)_minmax(0,0.78fr)_40px] items-center gap-2 lg:grid-cols-[220px_170px_36px]">
            <label className="showcase-control-pill grid h-10 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-full px-3 lg:h-9">
              <span className="font-mono text-[9px] tracking-[0.14em] whitespace-nowrap text-white/36 uppercase">{t('common.categories')}</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-full min-w-0 rounded-full bg-transparent font-mono text-[10px] tracking-[0.10em] text-white/68 uppercase outline-none"
              >
                <option value="all" className="bg-[#09090b] text-white">
                  {t('common.all')} · {publishedRepos.length}
                </option>
                {categories.map(([key, count]) => (
                  <option key={key} value={key} className="bg-[#09090b] text-white">
                    {categoryLabel(t, key)} · {count}
                  </option>
                ))}
              </select>
            </label>
            <label className="showcase-control-pill grid h-10 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-full px-3 lg:h-9">
              <span className="hidden font-mono text-[9px] tracking-[0.14em] whitespace-nowrap text-white/36 uppercase sm:inline">{t('common.sortBy')}</span>
              <select
                id="oss-sort"
                aria-label={t('common.sortBy')}
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value)}
                className="h-full min-w-0 rounded-full bg-transparent font-mono text-[10px] tracking-[0.10em] text-white/68 uppercase outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key} className="bg-[#09090b] text-white">
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setSortDirection((value) => (value === 'asc' ? 'desc' : 'asc'))}
              title={sortDirection === 'asc' ? t('fable.sort.ascending') : t('fable.sort.descending')}
              className="showcase-control-pill flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-white/50 transition-colors hover:border-white/25 hover:bg-white/[0.09] hover:text-white lg:h-9 lg:w-9"
            >
              {sortDirection === 'asc' ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </section>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:[grid-template-columns:repeat(auto-fill,minmax(330px,1fr))]">
        {filtered.map((item, itemIndex) => (
          <RepoCard key={item.id} item={item} index={itemIndex} language={language} translation={translationsByLanguage[language]?.[item.id]} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-white/12 py-16 text-center font-mono text-xs tracking-[0.18em] text-white/30 uppercase">
          {t('oss.noMatchingRepos')}
        </div>
      )}
    </main>
  )
}
