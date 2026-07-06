import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownAZ, ArrowUpAZ, Bookmark, CalendarDays, Check, Copy, ExternalLink, Eye, Heart, ImageOff, Loader2, MessageCircle, Repeat2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { FABLE5_FAVORITES_KEY, readFavoriteSet, writeFavoriteSet } from '@/lib/favorites'
import { loadShowcases, readCachedShowcases, showcaseScore } from '@/lib/fable5Data'
import { trackEvent } from '@/lib/analytics'
import claudeIcon from '@lobehub/icons-static-svg/icons/claude-color.svg'
import { useI18n } from '@/i18n.jsx'
import PreviewImage from './PreviewImage.jsx'

function getFavorites(favoritesKey) {
  return readFavoriteSet(favoritesKey)
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
        'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full border px-3 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors',
        active
          ? 'border-acid/45 bg-acid/14 text-acid shadow-[0_0_18px_rgba(212,255,79,0.10)]'
          : 'border-white/10 bg-white/[0.035] text-white/42 hover:border-white/25 hover:bg-white/[0.065] hover:text-white'
      )}
    >
      {label}
      <span className={cn('tabular-nums', active ? 'text-acid/65' : 'text-white/28')}>{count}</span>
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

function mediaItemsFor(item) {
  const seen = new Set()
  const urls = []
  const add = (url) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    urls.push(url)
  }
  add(item.mediaThumbUrl)
  for (const url of item.mediaUrls || []) {
    if (item.mediaThumbUrl && /\.mp4(\?|$)/i.test(url)) continue
    add(url)
  }
  return urls.map((url) => ({
    url,
    type: /\.mp4(\?|$)/i.test(url) ? 'video' : 'image',
  }))
}

function firstPreviewUrl(item) {
  return item.mediaThumbUrl || item.mediaUrls?.find((url) => !/\.mp4(\?|$)/i.test(url)) || ''
}

function imageSizeKey(url) {
  return `touchstone:image-size:${url}`
}

function readCachedImageSize(url) {
  if (!url) return null
  try {
    const value = JSON.parse(localStorage.getItem(imageSizeKey(url)) || 'null')
    return value?.width > 0 && value?.height > 0 ? value : null
  } catch {
    return null
  }
}

function writeCachedImageSize(url, img) {
  if (!url || !img?.naturalWidth || !img?.naturalHeight) return
  try {
    localStorage.setItem(imageSizeKey(url), JSON.stringify({ width: img.naturalWidth, height: img.naturalHeight }))
  } catch {}
}

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
  const [imageFailed, setImageFailed] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
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

  return (
    <div className="relative h-[180px] shrink-0 overflow-hidden bg-black sm:h-[210px]">
      {showImage ? (
        <>
          {!imageLoaded && <MediaLoadingOverlay />}
          <PreviewImage
            src={imageUrl}
            alt={`${item.title} by ${item.author}`}
            loaded={imageLoaded}
            priority={priority}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
          />
        </>
      ) : (
        <MediaPlaceholder label={videoUrl ? t('fable.videoPreviewUnavailable') : t('fable.noPreview')} />
      )}
      <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="absolute inset-0" aria-label={t('common.sourcePost')} />
    </div>
  )
}

function MasonryImage({ item, priority = false }) {
  const { t } = useI18n()
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = firstPreviewUrl(item)
  const [size, setSize] = useState(() => readCachedImageSize(imageUrl))

  if (!imageUrl || imageFailed) {
    return (
      <div className="aspect-[4/5]">
        <MediaPlaceholder label={item.media === 'text' ? t('fable.textOnly') : t('fable.noPreview')} />
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden bg-black" style={{ aspectRatio: size ? `${size.width} / ${size.height}` : '4 / 3' }}>
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-55 blur-2xl saturate-125"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.02),rgba(0,0,0,0.58))]" />
      <img
        src={imageUrl}
        alt={`${item.title} by ${item.author}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        className="absolute inset-0 z-10 h-full w-full object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.38)]"
        onLoad={(event) => {
          const next = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }
          if (next.width && next.height && (!size || size.width !== next.width || size.height !== next.height)) {
            writeCachedImageSize(imageUrl, event.currentTarget)
            setSize(next)
          }
        }}
        onError={() => setImageFailed(true)}
      />
    </div>
  )
}

function VisualMasonryCard({ item, index, onOpen }) {
  const { language } = useI18n()
  const [avatarFailed, setAvatarFailed] = useState(false)
  const metrics = item.metrics || {}
  const dateLabel = item.date
    ? new Date(`${item.date}T00:00:00`).toLocaleDateString(language, { month: 'short', day: 'numeric' })
    : ''

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group mb-4 w-full cursor-zoom-in break-inside-avoid overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0f] text-left shadow-[0_24px_80px_rgba(0,0,0,0.22)] transition-all hover:-translate-y-0.5 hover:border-white/30"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '360px' }}
    >
      <div className="relative">
        <MasonryImage item={item} priority={index < INITIAL_PRIORITY_IMAGES} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/82 via-black/36 to-transparent p-3 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <div className="flex min-w-0 items-center gap-2">
            {item.avatarUrl && !avatarFailed ? (
              <img
                src={item.avatarUrl}
                alt={item.author}
                loading="lazy"
                decoding="async"
                className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 font-mono text-[10px] text-white/55">
                {(item.handle || '?')[1] || '?'}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-white/90">{item.author}</div>
              <div className="truncate font-mono text-[9px] tracking-[0.12em] text-white/42 uppercase">
                {dateLabel || item.handle}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-white/55">
              <Heart className="h-3 w-3" />
              {n(metrics.likes)}
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}

function DetailImageFrame({ src, alt }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-white/10 bg-black">
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl saturate-125"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.03),rgba(0,0,0,0.66))]" />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="relative z-10 max-h-[78vh] w-full object-contain p-2 drop-shadow-[0_16px_32px_rgba(0,0,0,0.42)]"
      />
    </div>
  )
}

function VisualDetailDialog({ item, translation, open, onOpenChange }) {
  const { t, language } = useI18n()
  const [copiedId, setCopiedId] = useState(false)
  const media = item ? mediaItemsFor(item) : []
  const copy = item ? localizedShowcaseCopy(item, translation) : { title: '', summary: [] }
  const metrics = item?.metrics || {}
  const dateLabel = item?.date
    ? new Date(`${item.date}T00:00:00`).toLocaleDateString(language, { year: 'numeric', month: 'short', day: 'numeric' })
    : ''
  const itemId = item?.id || ''
  const copyId = () => {
    if (!itemId) return
    navigator.clipboard.writeText(itemId)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 1200)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="flex h-[92vh] w-[min(1120px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg">
        <DialogTitle className="sr-only">{copy.title || item?.author || 'Showcase detail'}</DialogTitle>
        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-h-0 overflow-y-auto bg-black">
            <div className="flex flex-col gap-3 p-3 sm:p-4">
              {media.length > 0 ? (
                media.map((entry) => (
                  <div key={entry.url}>
                    {entry.type === 'video' ? (
                      <video src={entry.url} controls playsInline className="max-h-[78vh] w-full rounded-md border border-white/10 bg-black object-contain" />
                    ) : (
                      <DetailImageFrame src={entry.url} alt={copy.title || item.author} />
                    )}
                  </div>
                ))
              ) : (
                <div className="aspect-[4/3] overflow-hidden rounded-md border border-white/10">
                  <MediaPlaceholder />
                </div>
              )}
            </div>
          </div>
          <aside className="min-h-0 overflow-y-auto border-t border-white/10 bg-[#0c0c0f] p-4 lg:border-t-0 lg:border-l">
            <div className="flex items-start gap-3">
              {item?.avatarUrl ? (
                <img src={item.avatarUrl} alt={item.author} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-xs text-white/55">
                  {(item?.handle || '?')[1] || '?'}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{item?.author}</div>
                <div className="mt-0.5 truncate font-mono text-[10px] tracking-[0.12em] text-white/35 uppercase">{item?.handle}</div>
              </div>
              <DialogClose className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-white/10 text-white/45 transition-colors hover:text-white">
                <X className="h-4 w-4" />
              </DialogClose>
            </div>

            <div className="mt-5 space-y-3">
              {itemId && (
                <button
                  type="button"
                  onClick={copyId}
                  className="grid max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-white/70 bg-white px-3 py-2 text-left font-mono text-[11px] text-black shadow-[0_12px_28px_rgba(255,255,255,0.08)]"
                  title="Copy ID"
                >
                  <span className="rounded-full bg-black px-2 py-0.5 text-[9px] tracking-[0.14em] text-white uppercase">ID</span>
                  <span className="truncate">{itemId}</span>
                  {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-black/58" />}
                </button>
              )}
              {dateLabel && (
                <span className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] tracking-[0.08em] text-white/45 uppercase">
                  <CalendarDays className="h-3 w-3" />
                  {dateLabel}
                </span>
              )}
              {copy.title && <h2 className="text-xl leading-7 font-semibold tracking-tight text-white">{copy.title}</h2>}
              {copy.summary?.[0] && <p className="text-sm leading-6 text-white/78">{copy.summary[0]}</p>}
              {item?.originalText && (
                <p className="max-h-64 overflow-y-auto rounded-md border border-white/14 bg-white/[0.06] p-3 text-[13px] leading-5 whitespace-pre-wrap text-white/74">
                  {item.originalText}
                </p>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/8 pt-4 font-mono text-[10px] text-white/42">
              <span className="flex items-center gap-1.5"><Heart className="h-3 w-3" /> {n(metrics.likes)}</span>
              <span className="flex items-center gap-1.5"><Bookmark className="h-3 w-3" /> {n(metrics.bookmarks)}</span>
              <span className="flex items-center gap-1.5"><MessageCircle className="h-3 w-3" /> {n(metrics.replies)}</span>
              <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {n(metrics.views)}</span>
            </div>

            {item?.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-white/12 px-3 font-mono text-[10px] tracking-[0.14em] text-white/60 uppercase transition-colors hover:border-white/25 hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('common.sourcePost')}
              </a>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ShowcaseCard({ item, index, translation, favorite, copied, authLoaded, loginRequired, loggingIn, enableFavorite, onToggleFavorite, onCopy }) {
  const { t, language } = useI18n()
  const [avatarFailed, setAvatarFailed] = useState(false)
  const hasPrompt = Boolean(item.prompt?.trim())
  const metrics = item.metrics || {}
  const copy = localizedShowcaseCopy(item, translation)
  const summary = copy.summary
  const dateLabel = item.date
    ? new Date(`${item.date}T00:00:00`).toLocaleDateString(language, { year: 'numeric', month: 'short', day: 'numeric' })
    : ''

  return (
    <article
      className="flex h-[420px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0f] transition-colors hover:border-white/25 sm:h-[460px]"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '420px' }}
    >
      <MediaBlock item={item} priority={index < INITIAL_PRIORITY_IMAGES} />

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex min-h-10 shrink-0 items-start gap-3">
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
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{item.author}</div>
                <div className="mt-0.5 truncate font-mono text-[10px] tracking-[0.12em] text-white/35 uppercase">
                  {item.handle}
                </div>
              </div>
            </div>
          </a>
          <div className="flex items-center gap-1">
            {enableFavorite && (
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
            )}
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

        {dateLabel && (
          <div className="mt-2 flex h-5 shrink-0 items-center">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded border border-white/10 bg-white/[0.03] px-2 font-mono text-[10px] tracking-[0.08em] text-white/45 uppercase">
              <CalendarDays className="h-3 w-3 shrink-0 text-white/35" />
              <span className="truncate">{dateLabel}</span>
            </span>
          </div>
        )}

        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block h-[104px] shrink-0 overflow-hidden">
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

export default function Fable5Page({
  onBack,
  authLoaded = true,
  authEmail,
  onLogin,
  loggingIn = false,
  dataBase = '/fable5-data',
  dataLabel = 'fable5',
  title = 'FABLE 5',
  iconSrc = claudeIcon,
  favoritesKey = FABLE5_FAVORITES_KEY,
  favoritesApiBase = '/api/fable5',
  analyticsPrefix = 'fable5',
  enableFavorites = true,
  visualMode = false,
}) {
  const { t, language } = useI18n()
  const [cachedInitial] = useState(() => readCachedShowcases({ dataBase, start: 0, count: SHARD_LOAD_STEP }))
  const [items, setItems] = useState(() => cachedInitial?.items || null)
  const [index, setIndex] = useState(() => cachedInitial?.index || null)
  const [loadedPageCount, setLoadedPageCount] = useState(() => cachedInitial?.loadedPages || 0)
  const [loadError, setLoadError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [query, setQuery] = useState('')
  const [scene, setScene] = useState('all')
  const [sortKey, setSortKey] = useState('date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [favorites, setFavorites] = useState(() => getFavorites(favoritesKey))
  const [copiedId, copy] = useCopy()
  const [selectedItem, setSelectedItem] = useState(null)
  const [translationsByLanguage, setTranslationsByLanguage] = useState({})
  const translationsByLanguageRef = useRef({})
  const translationInflight = useRef(new Set())
  const autoLoadRef = useRef(null)
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    if (!enableFavorites) return undefined
    if (!authEmail) {
      setFavorites(new Set())
      return undefined
    }
    let alive = true
    fetch(`${favoritesApiBase}/favorites`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (!alive) return
        const local = getFavorites(favoritesKey)
        const merged = new Set([...(data.favorites || []), ...local])
        setFavorites(merged)
        writeFavoriteSet(favoritesKey, merged)
        if (local.size > 0 && merged.size !== (data.favorites || []).length) {
          fetch(`${favoritesApiBase}/favorites`, {
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
  }, [authEmail, enableFavorites, favoritesApiBase, favoritesKey])

  useEffect(() => {
    let alive = true
    const cached = readCachedShowcases({ dataBase, start: 0, count: SHARD_LOAD_STEP })
    setItems(cached?.items || null)
    setIndex(cached?.index || null)
    setLoadedPageCount(cached?.loadedPages || 0)
    setLoadError('')
    setScene('all')
    setQuery('')
    loadingMoreRef.current = false
    loadShowcases({ dataBase, label: dataLabel, start: 0, count: SHARD_LOAD_STEP }).then(
      ({ index: nextIndex, items: nextItems, loadedPages }) => {
        if (!alive) return
        setIndex(nextIndex)
        setItems(nextItems)
        setLoadedPageCount(loadedPages)
      },
      (err) => alive && setLoadError(String(err?.message || err))
    )
    return () => {
      alive = false
    }
  }, [dataBase, dataLabel])

  const totalCount = index?.total || 0
  const totalPageCount = (index?.pages?.length || index?.chunks?.length || index?.shards?.length || 0)
  const canLoadMore = totalPageCount > loadedPageCount

  const loadMore = () => {
    if (!canLoadMore || loadingMoreRef.current || loadingMore) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    loadShowcases({ dataBase, label: dataLabel, start: loadedPageCount, count: SHARD_LOAD_STEP }).then(
      ({ items: nextItems, loadedPages }) => {
        setItems((current) => mergeShowcaseItems(current, nextItems))
        setLoadedPageCount((count) => count + loadedPages)
        loadingMoreRef.current = false
        setLoadingMore(false)
      },
      (err) => {
        setLoadError(String(err?.message || err))
        loadingMoreRef.current = false
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
  }, [canLoadMore, loadingMore, loadedPageCount])

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
  }, [canLoadMore, loadingMore, loadedPageCount])

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
    if (!items || !index || loadedPageCount >= totalPageCount) return undefined
    if (scene === 'all' && !query.trim()) return undefined
    let cancelled = false
    loadingMoreRef.current = true
    setLoadingMore(true)
    ;(async () => {
      let start = loadedPageCount
      try {
        while (!cancelled && start < totalPageCount) {
          const { items: nextItems, loadedPages } = await loadShowcases({ dataBase, label: dataLabel, start, count: SHARD_LOAD_STEP })
          if (cancelled) return
          setItems((current) => mergeShowcaseItems(current, nextItems))
          start += loadedPages
          setLoadedPageCount(start)
          if (!loadedPages) break
        }
      } catch (err) {
        if (!cancelled) setLoadError(String(err?.message || err))
      } finally {
        if (!cancelled) {
          loadingMoreRef.current = false
          setLoadingMore(false)
        }
      }
    })()
    return () => {
      cancelled = true
      loadingMoreRef.current = false
    }
  }, [scene, query, index, dataBase, dataLabel])

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
    if (!enableFavorites) return
    if (!authEmail) {
      onLogin?.()
      return
    }
    const favorite = !favorites.has(id)
    setFavorites((prev) => {
      const next = new Set(prev)
      favorite ? next.add(id) : next.delete(id)
      writeFavoriteSet(favoritesKey, next)
      return next
    })
    trackEvent(`${analyticsPrefix}_favorite`, { item_id: id, favorite })
    fetch(`${favoritesApiBase}/favorites/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite }),
    }).catch(() => {})
  }

  const copyPrompt = (id, prompt) => {
    copy(id, prompt)
    trackEvent(`${analyticsPrefix}_copy_prompt`, { item_id: id })
  }

  return (
    <main className="pb-20">
      <section className="mt-7 sm:mt-10">
        <button type="button" onClick={onBack} className="cursor-pointer text-left">
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white text-black shadow-[0_0_28px_rgba(255,255,255,0.12)] sm:h-14 sm:w-14">
              <img src={iconSrc} alt="" className="h-6 w-6 sm:h-8 sm:w-8" />
            </span>
            <span className="block font-pixel text-[30px] leading-none text-white sm:text-[48px]">{title}</span>
          </span>
        </button>
      </section>

      <section className="sticky top-14 z-30 mt-5 py-3 sm:mt-6">
        <div className="pointer-events-none absolute inset-0 z-0 rounded-[24px] bg-[#09090b]/86 backdrop-blur-xl" />
        <div className="relative z-10 rounded-[22px] border border-white/10 bg-black/32 p-1.5 shadow-[0_18px_64px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <label className="relative flex h-9 w-full shrink-0 items-center rounded-full border border-white/70 bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.08)] transition-colors focus-within:border-acid sm:w-[260px] lg:w-[320px]">
              <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-black/45" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('common.search')}
                className="h-full w-full rounded-full bg-transparent pr-3 pl-9 text-sm text-black outline-none placeholder:text-black/42"
              />
            </label>

            {scenes.length > 0 && (
              <div className="flex min-w-0 gap-1.5 overflow-x-auto sm:flex-1">
                <SceneChip label={t('common.all')} count={totalCount || items?.length || 0} active={scene === 'all'} onClick={() => setScene('all')} />
                {scenes.map(([key, count]) => (
                  <SceneChip key={key} label={categoryLabel(t, key)} count={count} active={scene === key} onClick={() => setScene(key)} />
                ))}
              </div>
            )}

            <div className="ml-auto flex w-full shrink-0 items-center justify-end gap-1.5 sm:w-auto">
              <label className="sr-only" htmlFor="fable-sort">
                {t('common.sortBy')}
              </label>
              <select
                id="fable-sort"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="h-9 max-w-[132px] rounded-full border border-white/10 bg-white/[0.045] px-3 font-mono text-[10px] tracking-[0.10em] text-white/62 uppercase outline-none transition-colors hover:border-white/24 hover:bg-white/[0.07] focus:border-white/28 sm:max-w-none"
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
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-white/50 transition-colors hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
              >
                {sortDirection === 'asc' ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div
        id="showcases"
        className={cn(
          'mt-5 scroll-mt-32',
          visualMode
            ? 'columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4'
            : 'grid grid-cols-1 gap-4 sm:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]'
        )}
      >
        {filtered.map((item, itemIndex) =>
          visualMode ? (
            <VisualMasonryCard key={item.id} item={item} index={itemIndex} onOpen={setSelectedItem} />
          ) : (
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
              enableFavorite={enableFavorites}
              onToggleFavorite={toggleFavorite}
              onCopy={copyPrompt}
            />
          )
        )}
        {!items && !loadError && Array.from({ length: 9 }, (_, index) => <LoadingCard key={index} />)}
      </div>

      {visualMode && (
        <VisualDetailDialog
          item={selectedItem}
          translation={selectedItem ? translationsByLanguage[language]?.[selectedItem.id] : null}
          open={Boolean(selectedItem)}
          onOpenChange={(open) => !open && setSelectedItem(null)}
        />
      )}

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
