import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const WEB_DIR = join(ROOT, 'apps', 'web')
const WEB_DIST_DIR = join(WEB_DIR, 'dist')

const TARGET_DIR = process.env.TOUCHSTONE_DEPLOY_DIR || '/Users/linshu/Deploy/touchstone'
const SERVICE_LABEL = process.env.TOUCHSTONE_LAUNCHCTL_LABEL || 'ai.jefflin.touchstone'
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://touchstone.jefflin.ai'
const LOCAL_BASE_URL = process.env.LOCAL_BASE_URL || 'http://127.0.0.1:3000'
const REQUIRED_BUNDLE_MARKERS = ['ossRadar', 'nav.ossRadar', 'nav.ossRadarShort']

function run(command, args, options = {}) {
  console.log(`$ ${[command, ...args].join(' ')}`)
  execFileSync(command, args, {
    cwd: options.cwd || ROOT,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: options.capture ? 'utf8' : undefined,
  })
}

function read(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd || ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim()
}

function assetPathFromHtml(html) {
  const match = html.match(/<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/)
  if (!match) throw new Error('Could not find built index bundle in index.html')
  return match[1]
}

async function fetchText(url, attempts = 8) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`${url} HTTP ${res.status}`)
      return await res.text()
    } catch (error) {
      lastError = error
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 750))
    }
  }
  throw lastError
}

async function main() {
  if (!existsSync(TARGET_DIR)) {
    throw new Error(`Deploy target does not exist: ${TARGET_DIR}`)
  }

  run('npm', ['--workspace', '@touchstone/server', 'run', 'test'])
  run('npm', ['--workspace', '@touchstone/web', 'run', 'build'])

  const sourceIndex = readFileSync(join(WEB_DIST_DIR, 'index.html'), 'utf8')
  const sourceAsset = assetPathFromHtml(sourceIndex)
  const sourceBundle = readFileSync(join(WEB_DIST_DIR, sourceAsset.replace(/^\//, '')), 'utf8')
  const missingMarkers = REQUIRED_BUNDLE_MARKERS.filter((marker) => !sourceBundle.includes(marker))
  if (missingMarkers.length) {
    throw new Error(`Built bundle is missing expected markers: ${missingMarkers.join(', ')}`)
  }

  mkdirSync(join(TARGET_DIR, 'apps', 'server'), { recursive: true })
  mkdirSync(join(TARGET_DIR, 'apps', 'web'), { recursive: true })

  run('rsync', ['-a', 'package.json', 'package-lock.json', 'agents.json', `${TARGET_DIR}/`])
  run('rsync', ['-a', '--exclude', '*.test.js', 'apps/server/', `${TARGET_DIR}/apps/server/`])
  writeFileSync(join(TARGET_DIR, 'server.js'), "import './apps/server/server.js'\n")
  run('rsync', ['-a', 'apps/web/package.json', `${TARGET_DIR}/apps/web/`])
  run('rsync', ['-a', '--delete', 'apps/web/dist/', `${TARGET_DIR}/apps/web/dist/`])
  run('npm', ['install'], { cwd: TARGET_DIR })

  const targetIndex = readFileSync(join(TARGET_DIR, 'apps', 'web', 'dist', 'index.html'), 'utf8')
  const targetAsset = assetPathFromHtml(targetIndex)
  if (targetAsset !== sourceAsset) {
    throw new Error(`Target index references ${targetAsset}, expected ${sourceAsset}`)
  }

  const uid = typeof process.getuid === 'function' ? process.getuid() : read('id', ['-u'])
  run('launchctl', ['kickstart', '-k', `gui/${uid}/${SERVICE_LABEL}`])

  const health = await fetchText(`${LOCAL_BASE_URL}/api/health`)
  const parsedHealth = JSON.parse(health)
  if (!parsedHealth.ok) throw new Error(`Local health check failed: ${health}`)
  const localAgents = JSON.parse(await fetchText(`${LOCAL_BASE_URL}/api/agents`))
  const codex = localAgents.agents?.find((agent) => agent.id === 'codex')
  const opencode = localAgents.agents?.find((agent) => agent.id === 'opencode')
  if (!codex?.health || typeof codex.health.compatible !== 'boolean') {
    throw new Error('Local agent capability preflight is missing')
  }
  if (!opencode) throw new Error('Local OpenCode adapter is missing')

  const localHtml = await fetchText(`${LOCAL_BASE_URL}/`)
  const localAsset = assetPathFromHtml(localHtml)
  if (localAsset !== sourceAsset) {
    throw new Error(`Local HTML references ${localAsset}, expected ${sourceAsset}`)
  }

  const publicHtml = await fetchText(`${PUBLIC_BASE_URL}/`)
  const publicAsset = assetPathFromHtml(publicHtml)
  if (publicAsset !== sourceAsset) {
    throw new Error(`Public HTML references ${publicAsset}, expected ${sourceAsset}`)
  }
  const publicRuns = JSON.parse(await fetchText(`${PUBLIC_BASE_URL}/api/runs`))
  const leakedRun = publicRuns.runs?.find(
    (run) => run.publishState !== 'published' && run.publishSource !== 'community-api'
  )
  if (leakedRun) throw new Error(`Public API exposed an unpublished run: ${leakedRun.id}`)

  console.log(
    JSON.stringify(
      {
        ok: true,
        target: TARGET_DIR,
        service: SERVICE_LABEL,
        bundle: sourceAsset,
        publicUrl: PUBLIC_BASE_URL,
        health: parsedHealth,
        agents: {
          codex: { version: codex.health.version, compatible: codex.health.compatible },
          opencode: { version: opencode.health.version, compatible: opencode.health.compatible },
        },
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(`[deploy-local-production] ${error.message}`)
  process.exit(1)
})
