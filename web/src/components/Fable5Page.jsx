import { useEffect, useMemo, useState } from 'react'
import { ArrowDownAZ, ArrowUpAZ, Bookmark, Check, Copy, ExternalLink, Eye, Heart, ImageOff, MessageCircle, Play, Repeat2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FABLE5_FAVORITES_KEY, readFavoriteSet, writeFavoriteSet } from '@/lib/favorites'
import { loadFable5Showcases, showcaseScore } from '@/lib/fable5Data'
import claudeIcon from '@lobehub/icons-static-svg/icons/claude-color.svg'

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
  { key: 'date', label: 'Created' },
  { key: 'score', label: 'Showcase' },
  { key: 'likes', label: 'Likes' },
  { key: 'bookmarks', label: 'Favorites' },
  { key: 'replies', label: 'Comments' },
]

const SHARD_LOAD_STEP = 2
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

function MediaPlaceholder({ label = 'no preview from source' }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] bg-[length:18px_18px]">
      <div className="flex flex-col items-center gap-2 px-4 text-center text-white/28">
        <ImageOff className="h-6 w-6" />
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase">{label}</span>
      </div>
    </div>
  )
}

function MediaBlock({ item }) {
  const [playing, setPlaying] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const videoUrl = item.media === 'video' ? item.mediaUrls?.find((url) => /\.mp4(\?|$)/i.test(url)) : ''
  const remoteImageUrl = item.mediaUrls?.find((url) => !/\.mp4(\?|$)/i.test(url))
  const imageUrl = item.mediaThumbUrl || remoteImageUrl
  const showImage = imageUrl && !imageFailed

  if (!imageUrl && !videoUrl) {
    return (
      <div className="relative h-[210px] shrink-0 overflow-hidden bg-black">
        <MediaPlaceholder label={item.media === 'text' ? 'text-only post' : 'no preview from source'} />
        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="absolute inset-0" aria-label="Open source post" />
      </div>
    )
  }

  if (playing && videoUrl && !videoFailed) {
    return (
      <div className="h-[210px] shrink-0 overflow-hidden bg-black">
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
    <div className="relative h-[210px] shrink-0 overflow-hidden bg-black">
      {showImage ? (
        <img
          src={imageUrl}
          alt={`${item.title} by ${item.author}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <MediaPlaceholder label={videoUrl ? 'video preview unavailable' : 'no preview from source'} />
      )}
      {videoUrl ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/10 transition-colors hover:bg-black/25"
          title="Play video"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white shadow-lg backdrop-blur">
            <Play className="ml-0.5 h-5 w-5 fill-white" />
          </span>
        </button>
      ) : (
        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="absolute inset-0" aria-label="Open source post" />
      )}
      {videoFailed && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute right-2 bottom-2 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-white/70"
        >
          open source
        </a>
      )}
    </div>
  )
}

function ShowcaseCard({ item, favorite, copied, onToggleFavorite, onCopy }) {
  const [avatarFailed, setAvatarFailed] = useState(false)
  const hasPrompt = Boolean(item.prompt?.trim())
  const metrics = item.metrics || {}
  const summary = item.summary?.length ? item.summary : []

  return (
    <article className="flex h-[460px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0f] transition-colors hover:border-white/25">
      <MediaBlock item={item} />

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex h-10 shrink-0 items-start gap-3">
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2.5">
              {item.avatarUrl && !avatarFailed ? (
                <img
                  src={item.avatarUrl}
                  alt={item.author}
                  loading="lazy"
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
                  {item.handle} · {new Date(item.date).toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>
          </a>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleFavorite(item.id)}
              title={favorite ? '取消收藏' : '收藏'}
              className={cn(
                'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border transition-colors',
                favorite ? 'border-rose-400/35 bg-rose-400/10 text-rose-300' : 'border-white/10 text-white/40 hover:text-white'
              )}
            >
              <Heart className={cn('h-3.5 w-3.5', favorite && 'fill-rose-300')} />
            </button>
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              title="原帖"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/40 transition-colors hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 block h-[104px] shrink-0 overflow-hidden">
          <h2 className="line-clamp-2 text-[15px] leading-6 font-medium text-white/90">{item.title}</h2>
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
              {copied ? 'copied' : 'prompt'}
            </button>
          </div>
        )}

        <div className="mt-auto flex shrink-0 items-center gap-4 border-t border-white/8 pt-3 font-mono text-[10px] text-white/35">
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

export default function Fable5Page({ onBack }) {
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

  useEffect(() => {
    let alive = true
    loadFable5Showcases({ start: 0, count: SHARD_LOAD_STEP }).then(
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
        setItems((current) => {
          const byId = new Map((current || []).map((item) => [item.id, item]))
          for (const item of nextItems) byId.set(item.id, item)
          return [...byId.values()]
        })
        setLoadedShardCount((count) => count + loadedShards)
        setLoadingMore(false)
      },
      (err) => {
        setLoadError(String(err?.message || err))
        setLoadingMore(false)
      }
    )
  }

  const scenes = useMemo(() => {
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
  }, [items])

  const filtered = useMemo(() => {
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
        `${item.author} ${item.handle} ${item.originalText} ${item.scene || ''} ${(item.categories || []).join(' ')} ${(item.tags || []).join(' ')}`
          .toLowerCase()
          .includes(q)
      )
    }
    return [...list].sort((a, b) => compareShowcases(a, b, sortKey, sortDirection))
  }, [items, scene, query, sortKey, sortDirection])

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      writeFavoriteSet(FABLE5_FAVORITES_KEY, next)
      return next
    })
  }

  return (
    <main className="pb-20">
      <section className="mt-10 flex flex-wrap items-center justify-between gap-5">
        <button type="button" onClick={onBack} className="cursor-pointer text-left">
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white text-black shadow-[0_0_28px_rgba(255,255,255,0.12)] sm:h-14 sm:w-14">
              <img src={claudeIcon} alt="" className="h-6 w-6 sm:h-8 sm:w-8" />
            </span>
            <span className="block font-pixel text-[34px] leading-none text-white sm:text-[48px]">FABLE 5</span>
          </span>
        </button>
        <a
          href="#showcases"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-acid/30 bg-acid/10 px-3 font-mono text-[10px] tracking-[0.16em] text-acid uppercase transition-colors hover:bg-acid/15"
        >
          Showcase
          <span className="text-acid/60">{items ? `${n(filtered.length)}/${n(totalCount || items.length)}` : '...'}</span>
        </a>
      </section>

      <section className="sticky top-14 z-30 mt-6 py-3">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-0 w-screen -translate-x-1/2 bg-[#09090b]/86 backdrop-blur-xl" />
        <div className="relative z-10">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="h-9 w-full rounded-md border border-white/10 bg-black/30 pr-3 pl-9 text-sm text-white outline-none placeholder:text-white/24 focus:border-white/25"
              />
            </label>
            <div className="grid grid-cols-[auto_minmax(0,170px)_36px] items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.16em] whitespace-nowrap text-white/32 uppercase">Sort by</span>
              <label className="sr-only" htmlFor="fable-sort">
                Sort showcases
              </label>
              <select
                id="fable-sort"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="h-9 rounded-md border border-white/10 bg-black/30 px-3 font-mono text-[11px] tracking-[0.08em] text-white/70 uppercase outline-none focus:border-white/25"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key} className="bg-[#09090b] text-white">
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSortDirection((value) => (value === 'asc' ? 'desc' : 'asc'))}
                title={sortDirection === 'asc' ? '升序' : '降序'}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-black/30 text-white/50 transition-colors hover:border-white/25 hover:text-white"
              >
                {sortDirection === 'asc' ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {scenes.length > 0 && (
            <div className="mt-2">
              <div className="mb-1.5 font-mono text-[10px] tracking-[0.16em] text-white/32 uppercase">Categories</div>
              <div className="flex flex-wrap gap-1.5">
                <SceneChip label="all" count={items?.length || 0} active={scene === 'all'} onClick={() => setScene('all')} />
                {scenes.map(([key, count]) => (
                  <SceneChip key={key} label={key} count={count} active={scene === key} onClick={() => setScene(key)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div id="showcases" className="mt-5 grid scroll-mt-32 gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {filtered.map((item) => (
          <ShowcaseCard
            key={item.id}
            item={item}
            favorite={favorites.has(item.id)}
            copied={copiedId === item.id}
            onToggleFavorite={toggleFavorite}
            onCopy={copy}
          />
        ))}
      </div>

      {items && canLoadMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="h-10 cursor-pointer rounded-md border border-white/12 bg-white/5 px-4 font-mono text-[11px] tracking-[0.14em] text-white/60 uppercase transition-colors hover:border-white/25 hover:text-white disabled:cursor-wait disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : `Load more ${n(items.length)}/${n(totalCount || items.length)}`}
          </button>
        </div>
      )}

      {!items && (
        <div className="mt-6 rounded-lg border border-dashed border-white/12 py-16 text-center font-mono text-xs tracking-[0.18em] text-white/30 uppercase">
          {loadError ? `failed to load showcases — ${loadError}` : 'loading showcases…'}
        </div>
      )}

      {items && filtered.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-white/12 py-16 text-center font-mono text-xs tracking-[0.18em] text-white/30 uppercase">
          No matching posts
        </div>
      )}
    </main>
  )
}
