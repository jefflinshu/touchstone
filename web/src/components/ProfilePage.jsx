import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ExternalLink, Heart, Pencil, Loader2, Check, X } from 'lucide-react'
import Avatar, { displayName } from './Avatar.jsx'
import ProjectCard from './ProjectCard.jsx'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FABLE5_FAVORITES_KEY, FAVORITES_CHANGED_EVENT, LIKED_PROJECTS_KEY, readFavoriteSet } from '@/lib/favorites'
import { loadFable5Showcases } from '@/lib/fable5Data'

function Stat({ label, value, accent }) {
  return (
    <div>
      <div className={`font-pixel text-xl ${accent ? 'text-acid' : 'text-white'}`}>{value}</div>
      <div className="mt-0.5 font-mono text-[10px] tracking-[0.18em] text-white/35 uppercase">{label}</div>
    </div>
  )
}

function EditForm({ profile, onSave, onCancel }) {
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
        <span className="font-mono text-[10px] tracking-[0.18em] text-white/35 uppercase">昵称</span>
        <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="昵称" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.18em] text-white/35 uppercase">头像 URL</span>
        <Input value={picture} onChange={(e) => setPicture(e.target.value)} placeholder="https://…" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.18em] text-white/35 uppercase">Bio</span>
        <Textarea rows={3} value={bio} maxLength={500} onChange={(e) => setBio(e.target.value)} placeholder="一句话介绍自己…" />
      </label>
      {error && <span className="font-mono text-xs text-red-400">{error}</span>}
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={saving} onClick={save} className="font-mono text-[10px] tracking-[0.15em] uppercase">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="font-mono text-[10px] tracking-[0.15em] uppercase">
          <X className="h-3 w-3" /> Cancel
        </Button>
      </div>
    </div>
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
  onOpenUser,
}) {
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

  return (
    <div className="mt-6">
      <Button variant="outline" size="sm" onClick={onBack} className="font-mono text-[10px] tracking-[0.15em] uppercase">
        <ArrowLeft className="h-3 w-3" /> Back
      </Button>

      <div className="mt-5 flex flex-col gap-6 lg:flex-row">
        {/* 左侧：资料卡 */}
        <aside className="w-full shrink-0 lg:w-[300px]">
          <div className="sticky top-20 rounded-lg border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-4">
              <Avatar email={email} picture={profile.picture} className="h-16 w-16 text-2xl" />
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold tracking-tight">{displayName(email, users)}</div>
                <div className="truncate font-mono text-[11px] text-white/35">{email}</div>
              </div>
            </div>

            {editing ? (
              <EditForm
                profile={profile}
                onSave={async (p) => {
                  await onSaveProfile(p)
                  setEditing(false)
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <>
                <p className="mt-4 text-[13px] leading-6 whitespace-pre-wrap text-white/70">
                  {profile.bio || <span className="text-white/25">{isMe ? '还没有 bio，点击 Edit 介绍一下自己' : 'No bio yet'}</span>}
                </p>
                {isMe && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(true)}
                    className="mt-4 font-mono text-[10px] tracking-[0.15em] uppercase"
                  >
                    <Pencil className="h-3 w-3" /> Edit Profile
                  </Button>
                )}
              </>
            )}

            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/8 pt-4">
              <Stat label="Cases" value={myGroups.length} />
              <Stat label="Runs" value={myRuns.length} />
              <Stat
                label={
                  <span className="flex items-center gap-1">
                    <Heart className="h-2.5 w-2.5" /> Likes
                  </span>
                }
                value={likesReceived}
                accent
              />
            </div>
          </div>
        </aside>

        {/* 右侧：参与和收藏的 cases */}
        <main className="min-w-0 flex-1">
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase">
            <button
              type="button"
              onClick={() => setTab('created')}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1 transition-colors',
                tab === 'created' ? 'border-acid bg-acid text-black' : 'border-white/12 text-white/45 hover:border-white/30 hover:text-white'
              )}
            >
              Created <span className={tab === 'created' ? 'text-black/60' : 'text-white/70'}>{myGroups.length}</span>
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
                Favorites <span className={tab === 'favorites' ? 'text-black/60' : 'text-emerald-200/70'}>{favoriteCount}</span>
              </button>
            )}
            <span className="h-px flex-1 bg-white/8" />
          </div>
          {tab === 'created' ? (
            myGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/12 py-20 text-center font-mono text-xs tracking-[0.2em] text-white/30 uppercase">
                No cases yet
              </div>
            ) : (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
                {myGroups.map((g) => (
                  <ProjectCard
                    key={g.project}
                    group={g}
                    views={views[g.project]}
                    likes={projectLikes[g.project]}
                    users={users}
                    onOpen={() => onOpenProject(g.project)}
                    onOpenUser={onOpenUser}
                  />
                ))}
              </div>
            )
          ) : favoriteCount === 0 ? (
            <div className="rounded-lg border border-dashed border-white/12 py-20 text-center font-mono text-xs tracking-[0.2em] text-white/30 uppercase">
              No favorites yet
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {favoriteGroups.length > 0 && (
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
                  {favoriteGroups.map((g) => (
                    <ProjectCard
                      key={g.project}
                      group={g}
                      views={views[g.project]}
                      likes={projectLikes[g.project]}
                      users={users}
                      onOpen={() => onOpenProject(g.project)}
                      onOpenUser={onOpenUser}
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
    </div>
  )
}
