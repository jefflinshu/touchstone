import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const WEB_DIR = join(ROOT, 'apps', 'web')
const DATA_MODULE = join(WEB_DIR, 'src', 'lib', 'ossRadarData.js')

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1'
    args[key] = value
  }
  return args
}

function todayShanghai() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function githubRepo(fullName) {
  try {
    const res = await fetch(`https://api.github.com/repos/${fullName}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'touchstone-oss-radar',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    })
    if (!res.ok) throw new Error(`${fullName}: GitHub HTTP ${res.status}`)
    return res.json()
  } catch (error) {
    const out = execFileSync('gh', ['api', `repos/${fullName}`], { encoding: 'utf8' })
    return JSON.parse(out)
  }
}

function normalizeRepo(seed, github) {
  return {
    ...seed,
    repo: github.full_name || seed.repo,
    name: seed.name || github.name,
    url: github.html_url || seed.url,
    homepage: github.homepage || seed.homepage || '',
    description: github.description || seed.description || '',
    language: github.language || seed.language || '',
    stars: Number(github.stargazers_count || 0),
    forks: Number(github.forks_count || 0),
    issues: Number(github.open_issues_count || 0),
    license: github.license?.spdx_id || seed.license || 'NOASSERTION',
    pushedAt: github.pushed_at || seed.pushedAt || '',
    tags: Array.isArray(seed.tags) && seed.tags.length ? seed.tags : github.topics || [],
  }
}

function jsString(value) {
  return JSON.stringify(value, null, 2)
}

const args = parseArgs(process.argv.slice(2))
const minStars = Number(args['min-stars'] || 0)
const xFrom = args['x-from'] || ''
const xTo = args['x-to'] || todayShanghai()
const moduleUrl = `${pathToFileURL(DATA_MODULE).href}?t=${Date.now()}`
const current = await import(moduleUrl)
const seeds = current.OSS_RADAR_REPOS || []

const refreshed = []
for (const seed of seeds) {
  const repo = await githubRepo(seed.repo)
  const item = normalizeRepo(seed, repo)
  if (item.stars >= minStars) refreshed.push(item)
}

const updatedAt = todayShanghai()
const snapshotAt = new Date().toISOString()
const source = {
  initializedCount: refreshed.length,
  githubSnapshotAt: snapshotAt,
  xWindow: {
    from: xFrom,
    to: xTo,
    status: xFrom ? 'query-window-defined' : 'not-fetched',
  },
  note: 'GitHub metadata is refreshed from the GitHub API. X-side collection stores monitoring keywords and query URLs; wire twitter-cli fetches before treating X counts as measured.',
}

const body = `export const OSS_RADAR_UPDATED_AT = ${JSON.stringify(updatedAt)}

export const OSS_RADAR_SOURCE = ${jsString(source)}

export const OSS_RADAR_REPOS = ${jsString(refreshed)}

export function xSearchUrl(keywords = []) {
  const query = [...keywords, 'GitHub', 'open source'].filter(Boolean).join(' OR ')
  return \`https://x.com/search?q=\${encodeURIComponent(query)}&src=typed_query&f=top\`
}
`

writeFileSync(DATA_MODULE, body)
console.log(`[oss-radar:update] wrote ${refreshed.length} repos to ${DATA_MODULE}`)
console.log(`[oss-radar:update] GitHub snapshot ${snapshotAt}; X window ${xFrom || '-'}..${xTo}`)
