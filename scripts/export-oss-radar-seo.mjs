import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OSS_RADAR_REPOS, OSS_RADAR_UPDATED_AT } from '../apps/web/src/lib/ossRadarData.js'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUTPUT_FILE = resolve(SCRIPT_DIR, '../apps/web/public/oss-radar-seo.json')

const items = OSS_RADAR_REPOS.filter((repo) => repo.decision !== 'exclude')
  .slice(0, 24)
  .map((repo) => ({
    title: repo.name,
    author: repo.repo?.split('/')[0] || '',
    sourceUrl: repo.url,
    date: repo.createdAt?.slice(0, 10) || '',
    summary: [repo.description, repo.thesis].filter(Boolean).join(' '),
  }))

mkdirSync(dirname(OUTPUT_FILE), { recursive: true })
writeFileSync(
  OUTPUT_FILE,
  `${JSON.stringify(
    {
      updatedAt: OSS_RADAR_UPDATED_AT,
      total: OSS_RADAR_REPOS.length,
      items,
    },
    null,
    2
  )}\n`
)
