import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ExternalLink, Eye, Heart, Layers3, Pencil, Loader2, Check, X } from 'lucide-react'
import Avatar, { displayName } from './Avatar.jsx'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FABLE5_FAVORITES_KEY, FAVORITES_CHANGED_EVENT, LIKED_PROJECTS_KEY, readFavoriteSet, writeFavoriteSet } from '@/lib/favorites'
import { loadFable5Showcases } from '@/lib/fable5Data'
import { useI18n } from '@/i18n.jsx'

function EditForm({ profile, onSave, onCancel }) {
  const { t } = useI18n()
  const [name, setName] = useState(profile.name || '')
  const [picture, setPicture] = useState(profile.picture || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      await onSave({ name, picture, bio })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.18em] text-white/35 uppercase">{t('profile.nickname')}</span>
        <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t('profile.nickname')} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.18em] text-white/35 uppercase">{t('profile.avatarUrl')}</span>
        <Input value={picture} onChange={(e) => setPicture(e.target.value)} placeholder="https://…" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.18em] text-white/35 uppercase">{t('profile.bio')}</span>
        <Textarea rows={3} value={bio} maxLength={500} onChange={(e) => setBio(e.target.value)} placeholder={t('profile.bioPlaceholder')} />
      </label>
      {error && <span className="font-mono text-xs text-red-400">{error}</span>}
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={saving} onClick={save} className="font-mono text-[10px] tracking-[0.15em] uppercase">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} {t('common.save')}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="font-mono text-[10px] tracking-[0.15em] uppercase">
          <X className="h-3 w-3" /> {t('common.cancel')}
        </Button>
      </div>
    </div>
  )
}

function projectInitials(name) {
  return String(name || '?')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function ProductCard({ group: g, views, likes, onOpen }) {
  const { t } = useI18n()
  const previewRun = g.runs.find((r) => r.preview && r.status === 'done') || g.runs.find((r) => r.preview)
  const category = g.category || g.runs.find((r) => r.category)?.category
  const done = g.runs.filter((r) => r.status === 'done').length

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0f] text-left transition-all hover:-translate-y-0.5 hover:border-white/25"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-black">
        {previewRun ? (
          <img
            src={`/api/runs/${previewRun.id}/preview`}
            alt={`${g.project} preview`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/[0.03]">
            <span className="pixel-cycle font-pixel text-3xl text-white/24">{projectInitials(g.project)}</span>
          </div>
        )}
        <span className="absolute top-3 left-3 flex h-10 w-10 items-center justify-center rounded-md border border-white/12 bg-black/70 font-pixel text-[15px] text-white shadow-lg backdrop-blur">
          {projectInitials(g.project)}
        </span>
      </div>
      <div className="p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold tracking-tight text-white">{g.project}</div>
            {category && (
              <div className="mt-1 font-mono text-[10px] tracking-[0.14em] text-white/35 uppercase">{category}</div>
            )}
          </div>
          <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-white/35 transition-colors group-hover:text-white" />
        </div>
        <div className="mt-4 flex items-center gap-4 border-t border-white/8 pt-3 font-mono text-[10px] text-white/35">
          <span className="flex items-center gap-1">
            <Layers3 className="h-3 w-3" />
            {done || g.runs.length}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {likes || 0}
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {views || 0}
          </span>
        </div>
      </div>
    </button>
  )
}

function FableFavoriteCard({ item }) {
  const thumb = item.mediaThumbUrl || item.mediaUrls?.[0]
  return (
    <a
      href={item.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className="group overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0f] transition-all hover:-translate-y-0.5 hover:border-white/25"
    >
      <div className="aspect-[16/10] overflow-hidden border-b border-white/8 bg-black">
        {thumb && (
          <img
            src={thumb}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[15px] leading-6 font-medium text-white/90">{item.title}</div>
            <div className="mt-1 truncate font-mono text-[10px] tracking-[0.12em] text-white/35 uppercase">
              {item.author}
            </div>
          </div>
          <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-white/35 transition-colors group-hover:text-white" />
        </div>
      </div>
    </a>
  )
}

export default function ProfilePage({
  email,
  groups,
  users,
  views,
  projectLikes,
  authEmail,
  initialTab = 'created',
  onSaveProfile,
  onBack,
  onOpenProject,
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState(initialTab === 'favorites' ? 'favorites' : 'created')
  const [favoriteVersion, setFavoriteVersion] = useState(0)
  const profile = users[email] || {}
  const isMe = authEmail === email

  useEffect(() => {
    setTab(isMe && initialTab === 'favorites' ? 'favorites' : 'created')
  }, [initialTab, email, isMe])

  useEffect(() => {
    const onChange = () => setFavoriteVersion((v) => v + 1)
    window.addEventListener(FAVORITES_CHANGED_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  useEffect(() => {
    if (!isMe || !authEmail) return
    let alive = true
    fetch('/api/fable5/favorites')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (!alive) return
        writeFavoriteSet(FABLE5_FAVORITES_KEY, new Set(data.favorites || []))
        setFavoriteVersion((v) => v + 1)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [authEmail, isMe])

  // 该用户参与过的项目（case）
  const myGroups = useMemo(
    () => groups.filter((g) => g.runs.some((r) => r.user === email)),
    [groups, email]
  )
  const myRuns = useMemo(
    () => groups.flatMap((g) => g.runs).filter((r) => r.user === email),
    [groups, email]
  )
  const favoriteProjectNames = useMemo(() => readFavoriteSet(LIKED_PROJECTS_KEY), [favoriteVersion])
  const favoriteFableIds = useMemo(() => readFavoriteSet(FABLE5_FAVORITES_KEY), [favoriteVersion])
  const favoriteGroups = useMemo(
    () => groups.filter((g) => favoriteProjectNames.has(g.project)),
    [groups, favoriteProjectNames]
  )
  const [fableShowcases, setFableShowcases] = useState([])
  useEffect(() => {
    if (favoriteFableIds.size === 0) return undefined
    let alive = true
    loadFable5Showcases({ count: Number.MAX_SAFE_INTEGER }).then(
      ({ items }) => alive && setFableShowcases(items),
      () => {}
    )
    return () => {
      alive = false
    }
  }, [favoriteFableIds])
  const favoriteFableItems = useMemo(
    () => fableShowcases.filter((item) => favoriteFableIds.has(item.id)),
    [fableShowcases, favoriteFableIds]
  )
  const favoriteCount = favoriteGroups.length + favoriteFableItems.length
  // 获赞 = 自己 run 的赞 + 参与项目的 case 赞
  const likesReceived =
    myRuns.reduce((s, r) => s + (r.likes || 0), 0) +
    myGroups.reduce((s, g) => s + (projectLikes[g.project] || 0), 0)
  const name = displayName(email, users)

  return (
    <div className="mt-6 pb-16">
      <Button variant="outline" size="sm" onClick={onBack} className="font-mono text-[10px] tracking-[0.15em] uppercase">
        <ArrowLeft className="h-3 w-3" /> {t('common.back')}
      </Button>

      <section className="mt-6 flex flex-col gap-5 border-b border-white/8 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar email={email} picture={profile.picture} className="h-16 w-16 text-2xl" />
          <div className="min-w-0">
            <h1 className="pixel-cycle truncate font-pixel text-[36px] leading-none tracking-[0.08em] text-white sm:text-[48px]">
              {name}
            </h1>
            {profile.bio && <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">{profile.bio}</p>}
            <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">
              <span>{myGroups.length} {t('profile.cases')}</span>
              <span>{myRuns.length} {t('profile.runs')}</span>
              <span>{likesReceived} {t('common.likes')}</span>
            </div>
          </div>
        </div>
        {isMe && !editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            className="w-fit font-mono text-[10px] tracking-[0.15em] uppercase"
          >
            <Pencil className="h-3 w-3" /> {t('profile.edit')}
          </Button>
        )}
      </section>

      {editing && (
        <div className="mt-5 max-w-xl rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <EditForm
            profile={profile}
            onSave={async (p) => {
              await onSaveProfile(p)
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      <main className="mt-6 min-w-0">
        <div className="mb-4 flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase">
            <button
              type="button"
              onClick={() => setTab('created')}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1 transition-colors',
                tab === 'created' ? 'border-acid bg-acid text-black' : 'border-white/12 text-white/45 hover:border-white/30 hover:text-white'
              )}
            >
              {t('profile.created')} <span className={tab === 'created' ? 'text-black/60' : 'text-white/70'}>{myGroups.length}</span>
            </button>
            {isMe && (
              <button
                type="button"
                onClick={() => setTab('favorites')}
                className={cn(
                  'cursor-pointer rounded-full border px-3 py-1 transition-colors',
                  tab === 'favorites'
                    ? 'border-emerald-400 bg-emerald-400 text-black'
                    : 'border-emerald-400/25 text-emerald-300 hover:border-emerald-400/60 hover:text-emerald-200'
                )}
              >
                {t('common.favorites')} <span className={tab === 'favorites' ? 'text-black/60' : 'text-emerald-200/70'}>{favoriteCount}</span>
              </button>
            )}
            <span className="h-px flex-1 bg-white/8" />
        </div>
        {tab === 'created' ? (
          myGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/12 py-20 text-center font-mono text-xs tracking-[0.2em] text-white/30 uppercase">
              {t('profile.noCases')}
            </div>
          ) : (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
              {myGroups.map((g) => (
                <ProductCard
                  key={g.project}
                  group={g}
                  views={views[g.project]}
                  likes={projectLikes[g.project]}
                  onOpen={() => onOpenProject(g.project)}
                />
              ))}
            </div>
          )
        ) : favoriteCount === 0 ? (
            <div className="rounded-lg border border-dashed border-white/12 py-20 text-center font-mono text-xs tracking-[0.2em] text-white/30 uppercase">
              {t('profile.noFavorites')}
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {favoriteGroups.length > 0 && (
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
                  {favoriteGroups.map((g) => (
                    <ProductCard
                      key={g.project}
                      group={g}
                      views={views[g.project]}
                      likes={projectLikes[g.project]}
                      onOpen={() => onOpenProject(g.project)}
                    />
                  ))}
                </div>
              )}
              {favoriteFableItems.length > 0 && (
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
                  {favoriteFableItems.map((item) => (
                    <FableFavoriteCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
      </main>
    </div>
  )
}
