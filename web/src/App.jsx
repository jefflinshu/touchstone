import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Check, ExternalLink, Globe2, Heart, Loader2, LogOut, Menu, Monitor, Moon, Search, Sun, User, X } from 'lucide-react'
import TaskForm from './components/TaskForm.jsx'
import ProjectPage from './components/ProjectPage.jsx'
import ProfilePage from './components/ProfilePage.jsx'
import Fable5Page from './components/Fable5Page.jsx'
import ProjectCard from './components/ProjectCard.jsx'
import SponsorCard from './components/SponsorCard.jsx'
import GuideCard from './components/GuideCard.jsx'
import Avatar from './components/Avatar.jsx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { trackEvent, trackPageView } from '@/lib/analytics'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useI18n } from './i18n.jsx'

const LOG_CAP = 30000
const THEME_STORAGE_KEY = 'touchstone-theme-mode'
const THEME_OPTIONS = [
  { value: 'auto', labelKey: 'theme.auto', icon: Monitor },
  { value: 'light', labelKey: 'theme.light', icon: Sun },
  { value: 'dark', labelKey: 'theme.dark', icon: Moon },
]

function resolveTheme(mode) {
  if (mode !== 'auto') return mode
  const hour = new Date().getHours()
  return hour >= 7 && hour < 19 ? 'light' : 'dark'
}

function getStoredThemeMode() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return THEME_OPTIONS.some((option) => option.value === value) ? value : 'auto'
  } catch {
    return 'auto'
  }
}

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value)
}

function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function setPageSeo({ title, description, canonicalPath = '/', imagePath = '/brand/touchstone-og.svg', type = 'website' }) {
  const origin = window.location.origin
  const canonical = new URL(canonicalPath, origin).href
  const image = new URL(imagePath, origin).href
  document.title = title
  upsertMeta('meta[name="description"]', { name: 'description', content: description })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
  upsertCanonical(canonical)
}

function navigate(path) {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/^@+/, '')
    .toLowerCase()
    .trim()
}

function compactSearchText(value) {
  return normalizeSearchText(value).replace(/[\s._-]+/g, '')
}

function projectGroupMatchesSearch(group, query, users) {
  const tokens = normalizeSearchText(query)
    .split(/\s+/)
    .map((token) => token.replace(/^@+/, ''))
    .filter(Boolean)
  if (tokens.length === 0) return true

  const fields = new Set([group.project, group.category])
  for (const run of group.runs) {
    fields.add(run.project)
    fields.add(run.category)
    fields.add(run.prompt)
    fields.add(run.agentName)
    fields.add(run.agentId)
    if (run.user) {
      const profile = users?.[run.user] || {}
      const local = String(run.user).split('@')[0]
      fields.add(run.user)
      fields.add(local)
      fields.add(`@${local}`)
      fields.add(profile.name)
      fields.add(profile.bio)
    }
  }

  const haystacks = [...fields].flatMap((field) => [normalizeSearchText(field), compactSearchText(field)])
  return tokens.every((token) => {
    const normalizedToken = normalizeSearchText(token)
    const compactToken = compactSearchText(token)
    return haystacks.some((field) => field.includes(normalizedToken) || (compactToken && field.includes(compactToken)))
  })
}

function GithubIcon({ className }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

function GoogleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.18 7.18 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z" />
    </svg>
  )
}

function ThemeMenuItems({ themeMode, resolvedTheme, onChange }) {
  const { t } = useI18n()
  return (
    <>
      {THEME_OPTIONS.map(({ value, labelKey, icon: Icon }) => (
        <DropdownMenuItem key={value} onSelect={() => onChange(value)}>
          <Icon className="h-3.5 w-3.5" />
          <span className="flex-1">{t(labelKey)}</span>
          {themeMode === value && <Check className="h-3.5 w-3.5 text-acid" />}
        </DropdownMenuItem>
      ))}
      {themeMode === 'auto' && (
        <div className="px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-white/30 uppercase">
          {t('common.now')}: {resolvedTheme}
        </div>
      )}
    </>
  )
}

function LanguageMenuItems() {
  const { language, languages, setLanguage, t } = useI18n()
  return (
    <>
      <div className="px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-white/30 uppercase">
        {t('common.language')}
      </div>
      {languages.map((item) => (
        <DropdownMenuItem key={item.code} onSelect={() => setLanguage(item.code)}>
          <Globe2 className="h-3.5 w-3.5" />
          <span className="flex-1">{item.nativeName}</span>
          <span className="text-white/30">{item.name}</span>
          {language === item.code && <Check className="h-3.5 w-3.5 text-acid" />}
        </DropdownMenuItem>
      ))}
    </>
  )
}

// 极简路由：支持 hash route，也允许 /fable5 直接打开
function useRoute() {
  const [loc, setLoc] = useState({ hash: location.hash, pathname: location.pathname, search: location.search })
  useEffect(() => {
    const onChange = () => setLoc({ hash: location.hash, pathname: location.pathname, search: location.search })
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [])
  const hash = loc.hash
  if (hash === '#/fable5') return { page: 'fable5' }
  let m = hash.match(/^#\/p\/(.+)$/)
  if (m) return { page: 'project', project: decodeURIComponent(m[1]) }
  m = hash.match(/^#\/u\/(.+)$/)
  if (m) return { page: 'user', email: decodeURIComponent(m[1]) }
  if (loc.pathname === '/fable5') return { page: 'fable5' }
  m = loc.pathname.match(/^\/p\/([^/]+)\/?$/)
  if (m) return { page: 'project', project: decodeURIComponent(m[1]) }
  m = loc.pathname.match(/^\/u\/([^/]+)\/?$/)
  if (m) return { page: 'user', email: decodeURIComponent(m[1]), tab: new URLSearchParams(loc.search).get('tab') || 'created' }
  return { page: 'home' }
}

const goProject = (project) => navigate(`/p/${encodeURIComponent(project)}`)
const goUser = (email, tab) => navigate(`/u/${encodeURIComponent(email)}${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`)
const goHome = () => navigate('/')
const goFable5 = () => navigate('/fable5')
const X1_URL = 'https://x-1.dev'

function getAnalyticsPage(route) {
  if (route.page === 'fable5') return { path: '/fable5', title: 'Fable 5' }
  if (route.page === 'project') return { path: '/p/:project', title: 'Project detail' }
  if (route.page === 'user') return { path: route.tab ? `/u/:user?tab=${route.tab}` : '/u/:user', title: 'User profile' }
  return { path: '/', title: 'Home' }
}

export default function App() {
  const { t, language } = useI18n()
  const [agents, setAgents] = useState([])
  const [runs, setRuns] = useState([])
  const [views, setViews] = useState({})
  const [projectLikes, setProjectLikes] = useState({})
  const [logs, setLogs] = useState({})
  const [wsOk, setWsOk] = useState(false)
  const [auth, setAuth] = useState({ loaded: false, email: null, name: null, picture: null })
  const [loggingIn, setLoggingIn] = useState(false)
  const [users, setUsers] = useState({})
  const route = useRoute()
  // 新手指南：首次访问展示；有 CLI 未就绪时每个新会话再提醒一次
  const [showGuide, setShowGuide] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const isMobile = window.matchMedia?.('(max-width: 640px)').matches
    return route.page !== 'fable5' && !isMobile && params.get('guide') !== '0' && !localStorage.getItem('ts:guide:dismissed')
  })
  useEffect(() => {
    if (route.page === 'fable5') {
      setShowGuide(false)
      return
    }
    const params = new URLSearchParams(window.location.search)
    if (params.get('guide') === '0') return
    if (window.matchMedia?.('(max-width: 640px)').matches) return
    if (
      agents.some((a) => a.health?.ready === false) &&
      !localStorage.getItem('ts:guide:dismissed') &&
      !sessionStorage.getItem('ts:guide:dismissed')
    ) {
      setShowGuide(true)
    }
  }, [agents, route.page])
  const dismissGuide = useCallback(() => {
    setShowGuide(false)
    localStorage.setItem('ts:guide:dismissed', '1')
    sessionStorage.setItem('ts:guide:dismissed', '1')
    trackEvent('guide_dismiss')
  }, [])
  const [themeMode, setThemeMode] = useState(getStoredThemeMode)
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(getStoredThemeMode()))
  const wsRef = useRef(null)

  useEffect(() => {
    trackPageView(getAnalyticsPage(route))
  }, [route.page, route.project, route.email, route.tab])

  const changeThemeMode = useCallback((mode) => {
    setThemeMode(mode)
    trackEvent('theme_change', { theme_mode: mode })
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode)
    } catch {}
  }, [])

  useEffect(() => {
    const apply = () => {
      const next = resolveTheme(themeMode)
      setResolvedTheme(next)
      document.documentElement.dataset.theme = next
      document.documentElement.dataset.themeMode = themeMode
      document.documentElement.style.colorScheme = next
      upsertMeta('meta[name="theme-color"]', { name: 'theme-color', content: next === 'light' ? '#f7f7f2' : '#09090b' })
    }
    apply()
    const timer = themeMode === 'auto' ? setInterval(apply, 60 * 1000) : null
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [themeMode])

  const refresh = useCallback(async () => {
    const r = await fetch('/api/runs').then((r) => r.json())
    setRuns(r.runs)
    setViews(r.views || {})
    setProjectLikes(r.projectLikes || {})
    setUsers(r.users || {})
  }, [])

  const applyAuth = useCallback((d) => {
    setAuth({ loaded: true, email: d.email || null, name: d.name || null, picture: d.picture || null })
    if (d.email) setUsers((prev) => ({ ...prev, [d.email]: { ...prev[d.email], name: d.name, picture: d.picture, bio: d.bio } }))
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then(applyAuth)
      .catch(() => setAuth((a) => ({ ...a, loaded: true })))
  }, [applyAuth])

  const login = useCallback(async () => {
    if (loggingIn) return
    setLoggingIn(true)
    trackEvent('login_start', { method: 'google' })
    window.location.assign(`/api/auth/login?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`)}`)
  }, [loggingIn])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    setAuth({ loaded: true, email: null, name: null, picture: null })
    trackEvent('logout')
  }, [])

  const saveProfile = useCallback(
    async (p) => {
      const res = await fetch('/api/users/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'failed')
      }
      const d = await res.json()
      applyAuth({ ...d, loggedIn: true })
    },
    [applyAuth]
  )

  useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((d) => setAgents(d.agents))
    refresh()
  }, [refresh])

  // WebSocket 实时更新（断线自动重连）
  useEffect(() => {
    let closed = false
    let retry = null
    function connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${location.host}/ws`)
      wsRef.current = ws
      ws.onopen = () => {
        setWsOk(true)
        refresh()
      }
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'run') {
          setRuns((prev) => {
            const idx = prev.findIndex((r) => r.id === msg.run.id)
            if (idx === -1) return [msg.run, ...prev]
            const next = [...prev]
            next[idx] = msg.run
            return next
          })
        } else if (msg.type === 'log') {
          setLogs((prev) => {
            const cur = (prev[msg.runId] || '') + msg.chunk
            return { ...prev, [msg.runId]: cur.length > LOG_CAP ? cur.slice(-LOG_CAP) : cur }
          })
        } else if (msg.type === 'removed') {
          setRuns((prev) => prev.filter((r) => r.id !== msg.runId))
        } else if (msg.type === 'view') {
          setViews((prev) => ({ ...prev, [msg.project]: msg.views }))
        } else if (msg.type === 'projectLike') {
          setProjectLikes((prev) => ({ ...prev, [msg.project]: msg.likes }))
        } else if (msg.type === 'user') {
          setUsers((prev) => ({ ...prev, [msg.email]: msg.profile }))
        }
      }
      ws.onclose = () => {
        setWsOk(false)
        if (!closed) retry = setTimeout(connect, 2000)
      }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      wsRef.current?.close()
    }
  }, [refresh])

  const submitTask = useCallback(async (payload) => {
    trackEvent('task_submit', {
      runner_count: Array.isArray(payload.runners) ? payload.runners.length : undefined,
      publish: Boolean(payload.publish),
    })
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'failed')
    }
    const data = await res.json()
    if (data.project) {
      trackEvent('task_created')
      goProject(data.project)
    }
  }, [])

  const stopRun = useCallback(async (id) => {
    await fetch(`/api/runs/${id}/stop`, { method: 'POST' })
  }, [])

  const deleteRun = useCallback(async (id) => {
    await fetch(`/api/runs/${id}`, { method: 'DELETE' })
    setRuns((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const fetchLog = useCallback(async (id) => {
    const text = await fetch(`/api/runs/${id}/log`).then((r) => r.text())
    setLogs((prev) => ({ ...prev, [id]: text.length > LOG_CAP ? text.slice(-LOG_CAP) : text }))
  }, [])

  const groups = useMemo(() => {
    const map = new Map()
    for (const run of runs) {
      if (!map.has(run.project)) map.set(run.project, [])
      map.get(run.project).push(run)
    }
    const arr = [...map.entries()].map(([project, list]) => ({
      project,
      runs: [...list].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
      latest: list.reduce((m, r) => (r.createdAt > m ? r.createdAt : m), ''),
      category: list.find((r) => r.category)?.category || 'other',
    }))
    arr.sort((a, b) => (a.latest > b.latest ? -1 : 1))
    return arr
  }, [runs])

  const active = runs.filter((r) => r.status === 'running' || r.status === 'pending').length
  const currentIdx = route.page === 'project' ? groups.findIndex((g) => g.project === route.project) : -1
  const currentGroup = currentIdx >= 0 ? groups[currentIdx] : null

  useEffect(() => {
    if (route.page === 'fable5') {
      setPageSeo({
        title: 'Claude Fable 5 Prompts & Showcases · Touchstone',
        description: t('seo.fableDescription'),
        canonicalPath: '/fable5',
        type: 'website',
      })
      return
    }
    if (route.page === 'project' && currentGroup) {
      const latest = currentGroup.runs[currentGroup.runs.length - 1]
      const prompt = latest?.prompt ? `${t('common.prompt')}: ${latest.prompt.slice(0, 120)}` : t('seo.projectFallback')
      setPageSeo({
        title: `${currentGroup.project} · Touchstone Case`,
        description: `${prompt}${latest?.prompt?.length > 120 ? '...' : ''} ${t('project.agentsRuns', { agents: new Set(currentGroup.runs.map((r) => r.agentName)).size, runs: currentGroup.runs.length })}.`,
        canonicalPath: `/p/${encodeURIComponent(currentGroup.project)}`,
        type: 'article',
      })
      return
    }
    if (route.page === 'user') {
      const profile = users[route.email] || {}
      const name = profile.name || route.email
      setPageSeo({
        title: `${name} · Touchstone Profile`,
        description: profile.bio || t('seo.profileFallback', { name }),
        canonicalPath: `/u/${encodeURIComponent(route.email)}`,
        type: 'profile',
      })
      return
    }
    setPageSeo({
      title: t('seo.siteTitle'),
      description: t('seo.siteDescription'),
      canonicalPath: '/',
    })
  }, [route, currentGroup, users, t, language])

  // 推荐：同分类优先 → 热度（赞×3+浏览）→ 最新，排除当前项目
  const recos = useMemo(() => {
    if (!currentGroup) return []
    const score = (g) => (projectLikes[g.project] || 0) * 3 + (views[g.project] || 0)
    const others = groups.filter((g) => g.project !== currentGroup.project)
    const same = others.filter((g) => g.category === currentGroup.category)
    const rest = others.filter((g) => g.category !== currentGroup.category)
    same.sort((a, b) => score(b) - score(a))
    rest.sort((a, b) => score(b) - score(a))
    return [...same, ...rest].slice(0, 3)
  }, [currentGroup, groups, projectLikes, views])

  // 首页分类筛选
  const [catFilter, setCatFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const activeSearchQuery = searchQuery.trim()
  const categories = useMemo(() => [...new Set(groups.map((g) => g.category))], [groups])
  const filteredGroups = useMemo(() => {
    const byCategory = catFilter === 'all' ? groups : groups.filter((g) => g.category === catFilter)
    return activeSearchQuery ? byCategory.filter((g) => projectGroupMatchesSearch(g, activeSearchQuery, users)) : byCategory
  }, [activeSearchQuery, catFilter, groups, users])

  return (
    <>
      <div className="bg-arena" />
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2.5 px-4 sm:gap-4 sm:px-6">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault()
              goHome()
            }}
            className="group flex min-w-0 items-center gap-2.5"
            aria-label="Touchstone"
          >
            <img
              src="/brand/touchstone-mark.svg"
              alt=""
              className="h-7 w-7 shrink-0 rounded-[7px] shadow-[0_0_18px_rgba(212,255,79,0.16)]"
            />
            <span className="min-w-0">
              <span className="pixel-cycle block font-pixel text-[15px] leading-none tracking-[0.2em] text-white">
                TOUCHSTONE<span className="text-acid">_</span>
              </span>
            </span>
          </a>
          <nav className="ml-2 hidden items-center gap-1 rounded-md border border-white/8 bg-white/[0.025] p-1 md:flex">
            <button
              type="button"
              onClick={goFable5}
              className={`h-7 cursor-pointer rounded px-2.5 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors ${
                route.page === 'fable5'
                  ? 'border border-acid bg-acid text-black'
                  : 'border border-transparent text-white/60 hover:border-white/25 hover:bg-white/8 hover:text-white'
              }`}
            >
              {t('nav.fable5')}
            </button>
            <a
              href={X1_URL}
              target="_blank"
              rel="noreferrer"
              className="flex h-7 items-center gap-1 rounded border border-transparent px-2.5 font-mono text-[10px] tracking-[0.16em] text-white/60 uppercase transition-colors hover:border-white/25 hover:bg-white/8 hover:text-white"
            >
              x-1.dev
              <ExternalLink className="h-3 w-3 opacity-55" />
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2.5 sm:gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Menu"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-white/10 text-white/45 outline-none transition-colors hover:border-white/25 hover:text-white md:hidden"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px] font-mono text-[11px]">
                <DropdownMenuItem
                  onSelect={() => {
                    goFable5()
                    trackEvent('nav_fable5_mobile')
                  }}
                  className={route.page === 'fable5' ? 'bg-acid/15 text-acid focus:bg-acid/15 focus:text-acid' : ''}
                >
                  {t('nav.fable5')}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={X1_URL} target="_blank" rel="noreferrer">
                    x-1.dev
                    <ExternalLink className="ml-auto h-3.5 w-3.5" />
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {active > 0 && (
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-acid uppercase">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-acid" />
                {t('nav.running', { count: active })}
              </span>
            )}
            <a
              href="https://github.com/jefflinshu/touchstone"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-white/40 transition-colors hover:text-white"
              title="GitHub"
            >
              <GithubIcon className="h-4 w-4" />
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title={t('common.language')}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-white/10 text-white/45 outline-none transition-colors hover:border-white/25 hover:text-white"
                >
                  <Globe2 className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[190px] font-mono text-[11px]">
                <LanguageMenuItems />
              </DropdownMenuContent>
            </DropdownMenu>
            {auth.loaded &&
              (auth.email ? (
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 outline-none transition-opacity hover:opacity-80">
                    <Avatar email={auth.email} picture={auth.picture} className="h-5 w-5 text-[10px]" />
                    <span className="hidden font-mono text-[11px] text-white/45 sm:inline">
                      {auth.name || auth.email.split('@')[0]}
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => goUser(auth.email)}>
                      <User className="h-3.5 w-3.5" /> {t('nav.profile')}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-emerald-300 focus:text-emerald-200" onSelect={() => goUser(auth.email, 'favorites')}>
                      <Heart className="h-3.5 w-3.5 fill-emerald-400/20" /> {t('nav.myFavorites')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <ThemeMenuItems themeMode={themeMode} resolvedTheme={resolvedTheme} onChange={changeThemeMode} />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={logout}>
                      <LogOut className="h-3.5 w-3.5" /> {t('nav.signOut')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loggingIn}
                  onClick={login}
                  className="h-7 gap-2 font-mono text-[10px] tracking-[0.15em] uppercase"
                >
                  {loggingIn ? <Loader2 className="h-3 w-3 animate-spin" /> : <GoogleIcon className="h-3 w-3" />}
                  {loggingIn ? t('nav.waitingAuth') : t('nav.signIn')}
                </Button>
              ))}
            <span
              className={`h-1.5 w-1.5 rounded-full ${wsOk ? 'bg-acid shadow-[0_0_6px_rgba(212,255,79,0.9)]' : 'bg-red-500'}`}
              title={wsOk ? t('nav.live') : t('nav.disconnected')}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 pb-28 sm:px-6">
        {route.page === 'fable5' ? (
          <Fable5Page onBack={goHome} authLoaded={auth.loaded} authEmail={auth.email} onLogin={login} loggingIn={loggingIn} />
        ) : route.page === 'project' ? (
          currentGroup ? (
            <ProjectPage
              project={currentGroup.project}
              runs={currentGroup.runs}
              logs={logs}
              likes={projectLikes[currentGroup.project]}
              category={currentGroup.category}
              prevProject={groups[currentIdx - 1]?.project}
              nextProject={groups[currentIdx + 1]?.project}
              recos={recos}
              onOpenProject={goProject}
              onBack={goHome}
              onStop={stopRun}
              onDelete={deleteRun}
              onFetchLog={fetchLog}
            />
          ) : (
            <div className="mt-20 text-center font-mono text-xs tracking-[0.2em] text-white/30 uppercase">
              {runs.length === 0 ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : t('home.projectNotFound')}
            </div>
          )
        ) : route.page === 'user' ? (
          <ProfilePage
            email={route.email}
            groups={groups}
            users={users}
            views={views}
            projectLikes={projectLikes}
            authEmail={auth.email}
            initialTab={route.tab}
            onSaveProfile={saveProfile}
            onBack={goHome}
            onOpenProject={goProject}
            onOpenUser={goUser}
          />
        ) : (
          <>
            <div className="mt-10 flex flex-wrap items-center justify-between gap-5 sm:mt-14 sm:gap-6">
              <div>
                <h1 className="font-pixel text-[28px] leading-[1.18] text-white sm:text-[42px]">
                  {t('home.heroOne')}
                  <br />
                  <span className="text-acid">{t('home.heroTwo')}</span>
                </h1>
              </div>
              <SponsorCard />
            </div>

            <TaskForm agents={agents} onSubmit={submitTask} user={auth.email} onLogin={login} />

            <div className="mt-10 mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {['all', ...categories].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCatFilter(c)
                      trackEvent('category_filter', { category: c })
                    }}
                    className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.15em] uppercase transition-colors ${
                      catFilter === c
                        ? 'border-acid bg-acid text-black'
                        : 'border-white/12 text-white/45 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
                <span className="ml-2 hidden h-px min-w-8 flex-1 bg-white/8 sm:block" />
              </div>
              <div className="relative w-full lg:w-[360px]">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => {
                    if (searchQuery.trim()) trackEvent('project_search', { query_length: searchQuery.trim().length })
                  }}
                  placeholder={t('home.searchPlaceholder')}
                  className="h-9 pr-9 pl-9 font-mono text-[11px]"
                  aria-label={t('common.search')}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-white/35 transition-colors hover:bg-white/8 hover:text-white"
                    title={t('common.cancel')}
                    aria-label={t('common.cancel')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {filteredGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/12 py-20 text-center font-pixel text-sm tracking-[0.2em] text-white/30 uppercase">
                {activeSearchQuery ? t('home.noSearchResults') : t('home.noRuns')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
                {filteredGroups.map((g) => (
                  <ProjectCard
                    key={g.project}
                    group={g}
                    views={views[g.project]}
                    likes={projectLikes[g.project]}
                    users={users}
                    onOpen={() => goProject(g.project)}
                    onOpenUser={goUser}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {route.page !== 'fable5' && (
        <GuideCard
          agents={agents}
          open={showGuide}
          onOpenChange={(o) => (o ? setShowGuide(true) : dismissGuide())}
        />
      )}
    </>
  )
}
