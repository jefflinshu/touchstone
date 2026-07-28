import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'apps', 'web', 'dist')
const DATA = join(ROOT, 'data')
const RUNS = join(ROOT, 'runs')
const EDGE_DIR = join(DIST, '_edge')

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function isPublished(run) {
  return run?.publishState === 'published' || run?.publishSource === 'community-api'
}

function safeRun(run, likes) {
  const { proc, publishAuth, ...publicFields } = run
  return { ...publicFields, likes: likes[run.id] || 0 }
}

if (!existsSync(join(DIST, 'index.html'))) {
  throw new Error('Web build is missing. Run npm run build:web before preparing edge assets.')
}

const allRuns = readJson(join(DATA, 'runs.json'), [])
const stats = {
  views: {},
  likes: {},
  projectLikes: {},
  ...readJson(join(DATA, 'stats.json'), {}),
}
const users = readJson(join(DATA, 'users.json'), {})
const publishedRuns = allRuns.filter(isPublished)
const publishedProjects = new Set(publishedRuns.map((run) => run.project).filter(Boolean))
const visibleEmails = new Set(publishedRuns.map((run) => run.user).filter(Boolean))
const visibleUsers = Object.fromEntries(
  Object.entries(users).filter(([email]) => visibleEmails.has(email))
)
const publicViews = Object.fromEntries(
  Object.entries(stats.views).filter(([project]) => publishedProjects.has(project))
)
const publicProjectLikes = Object.fromEntries(
  Object.entries(stats.projectLikes).filter(([project]) => publishedProjects.has(project))
)

mkdirSync(EDGE_DIR, { recursive: true })
writeFileSync(
  join(EDGE_DIR, 'runs.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      runs: publishedRuns.map((run) => safeRun(run, stats.likes)),
      views: publicViews,
      projectLikes: publicProjectLikes,
      users: visibleUsers,
    },
    null,
    2
  )
)

const avatarSource = join(DATA, 'avatars')
const avatarTarget = join(DIST, 'avatars')
rmSync(avatarTarget, { recursive: true, force: true })
if (existsSync(avatarSource)) {
  for (const profile of Object.values(visibleUsers)) {
    const picture = String(profile?.picture || '')
    if (!picture.startsWith('/avatars/')) continue
    const file = basename(picture)
    if (!file || file !== picture.slice('/avatars/'.length)) continue
    const source = join(avatarSource, file)
    if (!existsSync(source)) continue
    mkdirSync(avatarTarget, { recursive: true })
    copyFileSync(source, join(avatarTarget, file))
  }
}

const workspaceTarget = join(DIST, 'workspace')
rmSync(workspaceTarget, { recursive: true, force: true })
for (const run of publishedRuns) {
  if (!run.folder || run.folder.includes('..')) continue
  const source = join(RUNS, run.folder)
  if (!existsSync(source)) continue
  cpSync(source, join(workspaceTarget, run.folder), {
    recursive: true,
    filter(path) {
      const name = path.split('/').pop() || ''
      return !name.startsWith('.') && name !== 'node_modules' && name !== 'AGENTS.md'
    },
  })
}

console.log(
  JSON.stringify({
    ok: true,
    publishedRuns: publishedRuns.length,
    snapshot: join(EDGE_DIR, 'runs.json'),
  })
)
