import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownAZ, ArrowUpAZ, Bookmark, Check, Copy, ExternalLink, Eye, Heart, ImageOff, Loader2, MessageCircle, Play, Repeat2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FABLE5_FAVORITES_KEY, readFavoriteSet, writeFavoriteSet } from '@/lib/favorites'
import { loadFable5Featured, loadFable5Showcases, showcaseScore } from '@/lib/fable5Data'
import { trackEvent } from '@/lib/analytics'
import claudeIcon from '@lobehub/icons-static-svg/icons/claude-color.svg'
import { useI18n } from '@/i18n.jsx'

function getFavorites() {
  return readFavoriteSet(FABLE5_FAVORITES_KEY)
}

function useCopy() {
  const [copiedId, setCopiedId] = useState(null)
  return [
    copiedId,
    (id, text) => {
      navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1300)
    },
  ]
}

function n(num) {
  const value = Number(num || 0)
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `${Math.round(value / 100) / 10}k`
  return value.toLocaleString()
}

function SceneChip({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-6 cursor-pointer items-center gap-1 rounded border px-2 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors',
        active
          ? 'border-acid/40 bg-acid/10 text-acid'
          : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white'
      )}
    >
      {label}
      <span className={active ? 'text-acid/60' : 'text-white/25'}>{count}</span>
    </button>
  )
}

const SORT_OPTIONS = [
  { key: 'date', labelKey: 'fable.sort.created' },
  { key: 'score', labelKey: 'fable.sort.score' },
  { key: 'likes', labelKey: 'fable.sort.likes' },
  { key: 'bookmarks', labelKey: 'fable.sort.bookmarks' },
  { key: 'replies', labelKey: 'fable.sort.replies' },
]

const SHARD_LOAD_STEP = 1
const INITIAL_PRIORITY_IMAGES = 6
const TRANSLATION_BATCH_SIZE = 12
const CATEGORY_ORDER = ['games', 'apps', 'websites', 'videos', '3d', 'design', 'agents', 'prompts', 'code', 'research', 'news', 'safety', 'experiments']

function sortValue(item, sortKey) {
  const metrics = item.metrics || {}
  if (sortKey === 'score') return showcaseScore(metrics)
  if (sortKey === 'date') return Date.parse(item.date || '') || 0
  return Number(metrics[sortKey] || 0)
}

function compareShowcases(a, b, sortKey, sortDirection) {
  const direction = sortDirection === 'asc' ? 1 : -1
  const diff = sortValue(a, sortKey) - sortValue(b, sortKey)
  if (diff !== 0) return diff * direction
  return (
    String(b.date || '').localeCompare(String(a.date || '')) ||
    showcaseScore(b.metrics) - showcaseScore(a.metrics)
  )
}

function categoryLabel(t, key) {
  const label = t(`fable.category.${key}`)
  return label === `fable.category.${key}` ? key : label
}

function chunkList(list, size) {
  const out = []
  for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size))
  return out
}

function mergeShowcaseItems(current, nextItems) {
  const byId = new Map((current || []).map((item) => [item.id, item]))
  for (const item of nextItems) byId.set(item.id, item)
  return [...byId.values()]
}

function localizedShowcaseCopy(item, translation) {
  return {
    title: translation?.title?.trim() || item.title,
    summary: translation?.summary?.trim() ? [translation.summary.trim()] : item.summary?.length ? item.summary : [],
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

function LoadingCard() {
  return (
    <article className="h-[420px] overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0f] sm:h-[460px]">
      <div className="h-[180px] animate-pulse bg-white/8 sm:h-[210px]" />
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-white/8" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-white/8" />
            <div className="h-2 w-20 rounded bg-white/6" />
          </div>
          <div className="h-8 w-8 rounded-md bg-white/6" />
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-4 w-11/12 rounded bg-white/8" />
          <div className="h-4 w-8/12 rounded bg-white/8" />
          <div className="h-3 w-full rounded bg-white/6" />
          <div className="h-3 w-9/12 rounded bg-white/6" />
        </div>
        <div className="h-6 w-20 rounded border border-white/8 bg-white/5" />
        <div className="mt-10 h-px bg-white/8" />
        <div className="flex gap-4">
          <div className="h-3 w-12 rounded bg-white/6" />
          <div className="h-3 w-12 rounded bg-white/6" />
          <div className="ml-auto h-3 w-16 rounded bg-white/6" />
        </div>
      </div>
    </article>
  )
}

function MediaBlock({ item, priority = false }) {
  const { t } = useI18n()
  const [playing, setPlaying] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const videoUrl = item.media === 'video' ? item.mediaUrls?.find((url) => /\.mp4(\?|$)/i.test(url)) : ''
  const remoteImageUrl = item.mediaUrls?.find((url) => !/\.mp4(\?|$)/i.test(url))
  const imageUrl = item.mediaThumbUrl || remoteImageUrl
  const showImage = imageUrl && !imageFailed

  if (!imageUrl && !videoUrl) {
    return (
      <div className="relative h-[180px] shrink-0 overflow-hidden bg-black sm:h-[210px]">
        <MediaPlaceholder label={item.media === 'text' ? t('fable.textOnly') : t('fable.noPreview')} />
        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="absolute inset-0" aria-label={t('common.sourcePost')} />
      </div>
    )
  }

  if (playing && videoUrl && !videoFailed) {
    return (
      <div className="h-[180px] shrink-0 overflow-hidden bg-black sm:h-[210px]">
        <video
          src={videoUrl}
          poster={item.mediaThumbUrl || undefined}
          className="h-full w-full object-contain"
          controls
          autoPlay
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
        />
      </div>
    )
  }

  return (
    <div className="relative h-[180px] shrink-0 overflow-hidden bg-black sm:h-[210px]">
      {showImage ? (
        <>
          {!imageLoaded && <MediaLoadingOverlay />}
          <img
            src={imageUrl}
            alt={`${item.title} by ${item.author}`}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchpriority={priority ? 'high' : 'auto'}
            className={cn(
              'h-full w-full object-cover transition duration-300 hover:scale-[1.02]',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
          />
        </>
      ) : (
        <MediaPlaceholder label={videoUrl ? t('fable.videoPreviewUnavailable') : t('fable.noPreview')} />
      )}
      {videoUrl ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/10 transition-colors hover:bg-black/25"
          title={t('fable.playVideo')}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white shadow-lg backdrop-blur">
            <Play className="ml-0.5 h-5 w-5 fill-white" />
          </span>
        </button>
      ) : (
        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="absolute inset-0" aria-label={t('common.sourcePost')} />
      )}
      {videoFailed && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute right-2 bottom-2 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-white/70"
        >
          {t('common.openSource')}
        </a>
      )}
    </div>
  )
}

function ShowcaseCard({ item, index, translation, favorite, copied, authLoaded, loginRequired, loggingIn, onToggleFavorite, onCopy }) {
  const { t, language } = useI18n()
  const [avatarFailed, setAvatarFailed] = useState(false)
  const hasPrompt = Boolean(item.prompt?.trim())
  const metrics = item.metrics || {}
  const copy = localizedShowcaseCopy(item, translation)
  const summary = copy.summary

  return (
    <article
      className="flex h-[420px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0f] transition-colors hover:border-white/25 sm:h-[460px]"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '420px' }}
    >
      <MediaBlock item={item} priority={index < INITIAL_PRIORITY_IMAGES} />

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex h-10 shrink-0 items-start gap-3">
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2.5">
              {item.avatarUrl && !avatarFailed ? (
                <img
                  src={item.avatarUrl}
                  alt={item.author}
                  loading="lazy"
                  decoding="async"
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-xs text-white/55">
                  {(item.handle || '?')[1] || '?'}
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">{item.author}</div>
                <div className="mt-0.5 truncate font-mono text-[10px] tracking-[0.12em] text-white/35 uppercase">
                  {item.handle} · {new Date(item.date).toLocaleDateString(language)}
                </div>
              </div>
            </div>
          </a>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleFavorite(item.id)}
              title={!authLoaded ? t('common.loading') : loginRequired ? t('task.errorLogin') : favorite ? t('fable.unfavorite') : t('fable.favorite')}
              disabled={!authLoaded || loggingIn}
              className={cn(
                'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border transition-colors disabled:cursor-wait disabled:opacity-70',
                favorite ? 'border-rose-400/35 bg-rose-400/10 text-rose-300' : 'border-white/10 text-white/40 hover:text-white'
              )}
            >
              {(!authLoaded || (loggingIn && loginRequired)) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Heart className={cn('h-3.5 w-3.5', favorite && 'fill-rose-300')} />}
            </button>
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              title={t('common.sourcePost')}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/40 transition-colors hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 block h-[104px] shrink-0 overflow-hidden">
          <h2 className="line-clamp-2 text-[15px] leading-6 font-medium text-white/90">{copy.title}</h2>
          {summary[0] && <p className="mt-1 line-clamp-3 text-[13px] leading-5 text-white/55">{summary[0]}</p>}
        </a>

        {hasPrompt && (
          <div className="mt-3 flex h-7 shrink-0 items-start">
            <button
              type="button"
              onClick={() => onCopy(item.id, item.prompt)}
              className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded border border-emerald-400/25 bg-emerald-400/5 px-2 font-mono text-[10px] tracking-[0.12em] text-emerald-300 uppercase"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? t('fable.promptCopied') : t('fable.prompt')}
            </button>
          </div>
        )}

        <div className="mt-auto flex shrink-0 items-center gap-3 border-t border-white/8 pt-3 font-mono text-[10px] text-white/35 sm:gap-4">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {n(metrics.likes)}
          </span>
          <span className="flex items-center gap-1">
            <Bookmark className="h-3 w-3" />
            {n(metrics.bookmarks)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {n(metrics.replies)}
          </span>
          <span className="flex items-center gap-1">
            <Repeat2 className="h-3 w-3" />
            {n(metrics.reposts)}
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {n(metrics.views)}
          </span>
        </div>
      </div>
    </article>
  )
}

export default function Fable5Page({ onBack, authLoaded = true, authEmail, onLogin, loggingIn = false }) {
  const { t, language } = useI18n()
  const [items, setItems] = useState(null)
  const [index, setIndex] = useState(null)
  const [loadedShardCount, setLoadedShardCount] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [query, setQuery] = useState('')
  const [scene, setScene] = useState('all')
  const [sortKey, setSortKey] = useState('date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [favorites, setFavorites] = useState(() => getFavorites())
  const [copiedId, copy] = useCopy()
  const [translationsByLanguage, setTranslationsByLanguage] = useState({})
  const translationsByLanguageRef = useRef({})
  const translationInflight = useRef(new Set())
  const autoLoadRef = useRef(null)

  useEffect(() => {
    if (!authEmail) {
      setFavorites(new Set())
      return undefined
    }
    let alive = true
    fetch('/api/fable5/favorites')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (!alive) return
        const local = getFavorites()
        const merged = new Set([...(data.favorites || []), ...local])
        setFavorites(merged)
        writeFavoriteSet(FABLE5_FAVORITES_KEY, merged)
        if (local.size > 0 && merged.size !== (data.favorites || []).length) {
          fetch('/api/fable5/favorites', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favorites: [...merged] }),
          }).catch(() => {})
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [authEmail])

  useEffect(() => {
    let alive = true
    loadFable5Featured().then(
      ({ index: nextIndex, items: nextItems, loadedShards }) => {
        if (!alive) return
        setIndex(nextIndex)
        setItems(nextItems)
        setLoadedShardCount(loadedShards)
      },
      (err) => alive && setLoadError(String(err?.message || err))
    )
    return () => {
      alive = false
    }
  }, [])

  const totalCount = index?.total || 0
  const totalShardCount = index?.shards?.length || 0
  const canLoadMore = totalShardCount > loadedShardCount

  const loadMore = () => {
    if (!canLoadMore || loadingMore) return
    setLoadingMore(true)
    loadFable5Showcases({ start: loadedShardCount, count: SHARD_LOAD_STEP }).then(
      ({ items: nextItems, loadedShards }) => {
        setItems((current) => mergeShowcaseItems(current, nextItems))
        setLoadedShardCount((count) => count + loadedShards)
        setLoadingMore(false)
      },
      (err) => {
        setLoadError(String(err?.message || err))
        setLoadingMore(false)
      }
    )
  }

  useEffect(() => {
    const target = autoLoadRef.current
    if (!target || !canLoadMore || loadingMore) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore()
      },
      { rootMargin: '900px 0px' }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [canLoadMore, loadingMore, loadedShardCount])

  useEffect(() => {
    if (!canLoadMore || loadingMore) return undefined
    let ticking = false
    const maybeLoadMore = () => {
      ticking = false
      const remaining = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight)
      if (remaining < 1200) loadMore()
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(maybeLoadMore)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    maybeLoadMore()
    return () => window.removeEventListener('scroll', onScroll)
  }, [canLoadMore, loadingMore, loadedShardCount])

  const scenes = useMemo(() => {
    if (Array.isArray(index?.categoryCounts) && index.categoryCounts.length) {
      return index.categoryCounts.map((item) => [item.key, item.count])
    }
    const counts = new Map()
    for (const item of items || []) {
      const categories = Array.isArray(item.categories) && item.categories.length ? item.categories : [item.scene || 'other']
      for (const key of categories) counts.set(key, (counts.get(key) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a[0])
      const bi = CATEGORY_ORDER.indexOf(b[0])
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      return b[1] - a[1]
    })
  }, [index, items])

  useEffect(() => {
    if (!items || !index || loadedShardCount >= totalShardCount) return undefined
    if (scene === 'all' && !query.trim()) return undefined
    let cancelled = false
    setLoadingMore(true)
    ;(async () => {
      let start = loadedShardCount
      try {
        while (!cancelled && start < totalShardCount) {
          const { items: nextItems, loadedShards } = await loadFable5Showcases({ start, count: SHARD_LOAD_STEP })
          if (cancelled) return
          setItems((current) => mergeShowcaseItems(current, nextItems))
          start += loadedShards
          setLoadedShardCount(start)
          if (!loadedShards) break
        }
      } catch (err) {
        if (!cancelled) setLoadError(String(err?.message || err))
      } finally {
        if (!cancelled) setLoadingMore(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [scene, query, index])

  useEffect(() => {
    translationsByLanguageRef.current = translationsByLanguage
  }, [translationsByLanguage])

  useEffect(() => {
    if (!items?.length) return undefined
    let cancelled = false
    const controllers = []
    const languageTranslations = translationsByLanguageRef.current[language] || {}
    const pendingItems = items
      .map((item) => ({
        id: item.id,
        title: item.title || '',
        summary: item.summary?.[0] || '',
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
          if (!(cancelled || err?.name === 'AbortError')) console.error('[fable5 translation] failed:', err)
        } finally {
          keys.forEach((key) => translationInflight.current.delete(key))
        }
      }
    })()

    return () => {
      cancelled = true
      controllers.forEach((controller) => controller.abort())
    }
  }, [items, language])

  const filtered = useMemo(() => {
    const languageTranslations = translationsByLanguage[language] || {}
    let list = items || []
    if (scene !== 'all') {
      list = list.filter((item) => {
        const categories = Array.isArray(item.categories) && item.categories.length ? item.categories : [item.scene || 'other']
        return categories.includes(scene)
      })
    }
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((item) =>
        `${item.author} ${item.handle} ${languageTranslations[item.id]?.title || ''} ${languageTranslations[item.id]?.summary || ''} ${item.title || ''} ${(item.summary || []).join(' ')} ${item.originalText} ${item.scene || ''} ${(item.categories || []).join(' ')} ${(item.tags || []).join(' ')}`
          .toLowerCase()
          .includes(q)
      )
    }
    return [...list].sort((a, b) => compareShowcases(a, b, sortKey, sortDirection))
  }, [items, scene, query, sortKey, sortDirection, language, translationsByLanguage])

  const toggleFavorite = (id) => {
    if (!authLoaded) return
    if (!authEmail) {
      onLogin?.()
      return
    }
    const favorite = !favorites.has(id)
    setFavorites((prev) => {
      const next = new Set(prev)
      favorite ? next.add(id) : next.delete(id)
      writeFavoriteSet(FABLE5_FAVORITES_KEY, next)
      return next
    })
    trackEvent('fable5_favorite', { item_id: id, favorite })
    fetch(`/api/fable5/favorites/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite }),
    }).catch(() => {})
  }

  const copyPrompt = (id, prompt) => {
    copy(id, prompt)
    trackEvent('fable5_copy_prompt', { item_id: id })
  }

  return (
    <main className="pb-20">
      <section className="mt-7 sm:mt-10">
        <button type="button" onClick={onBack} className="cursor-pointer text-left">
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white text-black shadow-[0_0_28px_rgba(255,255,255,0.12)] sm:h-14 sm:w-14">
              <img src={claudeIcon} alt="" className="h-6 w-6 sm:h-8 sm:w-8" />
            </span>
            <span className="block font-pixel text-[30px] leading-none text-white sm:text-[48px]">FABLE 5</span>
          </span>
        </button>
      </section>

      <section className="sticky top-14 z-30 mt-5 py-3 sm:mt-6">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-0 w-screen -translate-x-1/2 bg-[#09090b]/86 backdrop-blur-xl" />
        <div className="relative z-10">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('common.search')}
                className="h-9 w-full rounded-md border border-white/10 bg-black/30 pr-3 pl-9 text-sm text-white outline-none placeholder:text-white/24 focus:border-white/25"
              />
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_36px] items-center gap-2 sm:grid-cols-[auto_minmax(0,170px)_36px]">
              <span className="hidden font-mono text-[10px] tracking-[0.16em] whitespace-nowrap text-white/32 uppercase sm:inline">{t('common.sortBy')}</span>
              <label className="sr-only" htmlFor="fable-sort">
                {t('common.sortBy')}
              </label>
              <select
                id="fable-sort"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="h-9 rounded-md border border-white/10 bg-black/30 px-3 font-mono text-[11px] tracking-[0.08em] text-white/70 uppercase outline-none focus:border-white/25"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key} className="bg-[#09090b] text-white">
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSortDirection((value) => (value === 'asc' ? 'desc' : 'asc'))}
                title={sortDirection === 'asc' ? t('fable.sort.ascending') : t('fable.sort.descending')}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-black/30 text-white/50 transition-colors hover:border-white/25 hover:text-white"
              >
                {sortDirection === 'asc' ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {scenes.length > 0 && (
            <div className="mt-2">
              <div className="mb-1.5 font-mono text-[10px] tracking-[0.16em] text-white/32 uppercase">{t('common.categories')}</div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                <SceneChip label={t('common.all')} count={totalCount || items?.length || 0} active={scene === 'all'} onClick={() => setScene('all')} />
                {scenes.map(([key, count]) => (
                  <SceneChip key={key} label={categoryLabel(t, key)} count={count} active={scene === key} onClick={() => setScene(key)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div id="showcases" className="mt-5 grid grid-cols-1 scroll-mt-32 gap-4 sm:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {filtered.map((item, itemIndex) => (
          <ShowcaseCard
            key={item.id}
            item={item}
            index={itemIndex}
            translation={translationsByLanguage[language]?.[item.id]}
            favorite={Boolean(authEmail) && favorites.has(item.id)}
            copied={copiedId === item.id}
            authLoaded={authLoaded}
            loginRequired={authLoaded && !authEmail}
            loggingIn={loggingIn}
            onToggleFavorite={toggleFavorite}
            onCopy={copyPrompt}
          />
        ))}
        {!items && !loadError && Array.from({ length: 9 }, (_, index) => <LoadingCard key={index} />)}
      </div>

      {items && canLoadMore && (
        <div ref={autoLoadRef} className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="h-10 cursor-pointer rounded-md border border-white/12 bg-white/5 px-4 font-mono text-[11px] tracking-[0.14em] text-white/60 uppercase transition-colors hover:border-white/25 hover:text-white disabled:cursor-wait disabled:opacity-50"
          >
            {loadingMore ? t('common.loading') : t('fable.loadMore', { loaded: n(items.length), total: n(totalCount || items.length) })}
          </button>
        </div>
      )}

      {!items && loadError && (
        <div className="mt-6 rounded-lg border border-dashed border-white/12 py-16 text-center font-mono text-xs tracking-[0.18em] text-white/30 uppercase">
          {t('common.failedToLoad', { error: loadError })}
        </div>
      )}

      {items && filtered.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-white/12 py-16 text-center font-mono text-xs tracking-[0.18em] text-white/30 uppercase">
          {t('common.noMatchingPosts')}
        </div>
      )}
    </main>
  )
}
