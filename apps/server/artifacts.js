import fs from 'node:fs'
import path from 'node:path'

export const DELIVERY_MODES = new Set([
  'single-html',
  'single-svg',
  'single-markdown',
  'static-folder',
  'custom',
])

const TYPE_EXTENSIONS = {
  html: new Set(['.html', '.htm']),
  svg: new Set(['.svg']),
  markdown: new Set(['.md', '.markdown']),
}

const MODE_TYPES = {
  'single-html': 'html',
  'single-svg': 'svg',
  'single-markdown': 'markdown',
}

const PREFERRED_NAMES = {
  html: ['index.html', 'index.htm'],
  svg: ['index.svg', 'result.svg', 'output.svg'],
  markdown: ['plan.md', 'index.md', 'readme.md', 'result.md', 'output.md'],
}

// 为一批 run 分配互不冲突的目录名。
//
// 目录要到 run 真正启动时才创建，所以排队中的 run 在磁盘上还不存在；只查文件
// 系统会让两个排队的 run 拿到同一个名字，跑起来后互相覆盖产物。`claimed` 用来
// 带上那些已分配但尚未落盘的名字。
export function allocateRunFolder(projectSlug, base, { claimed, exists }) {
  const taken = (name) => claimed.has(`${projectSlug}/${name}`) || exists(projectSlug, name)
  let sub = base
  for (let n = 2; taken(sub); n += 1) sub = `${base}_${n}`
  const folder = `${projectSlug}/${sub}`
  claimed.add(folder)
  return folder
}

export function normalizeDeliveryMode(value, fallback = 'single-html') {
  const mode = String(value || '').trim().toLowerCase()
  return DELIVERY_MODES.has(mode) ? mode : fallback
}

export function expectedArtifactType(deliveryMode) {
  return MODE_TYPES[normalizeDeliveryMode(deliveryMode, 'custom')] || null
}

export function artifactTypeForEntry(entry) {
  const extension = path.extname(String(entry || '')).toLowerCase()
  return Object.entries(TYPE_EXTENSIONS).find(([, extensions]) => extensions.has(extension))?.[0] || null
}

function collectArtifacts(rootDir) {
  const queue = [{ rel: '', depth: 0 }]
  const files = []
  while (queue.length) {
    const { rel, depth } = queue.shift()
    if (depth > 3) continue
    let entries = []
    try {
      entries = fs.readdirSync(path.join(rootDir, rel), { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const relativePath = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        queue.push({ rel: relativePath, depth: depth + 1 })
        continue
      }
      const type = artifactTypeForEntry(entry.name)
      if (type) files.push({ entry: relativePath, type, depth })
    }
  }
  return files
}

function rankArtifact(artifact) {
  const basename = path.posix.basename(artifact.entry).toLowerCase()
  const preferredIndex = PREFERRED_NAMES[artifact.type].indexOf(basename)
  return [
    artifact.depth,
    preferredIndex === -1 ? PREFERRED_NAMES[artifact.type].length : preferredIndex,
    artifact.entry.toLowerCase(),
  ]
}

function compareArtifacts(left, right) {
  const a = rankArtifact(left)
  const b = rankArtifact(right)
  return a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2])
}

export function findArtifact(rootDir, preferredType = null) {
  if (!fs.existsSync(rootDir)) return null
  const artifacts = collectArtifacts(rootDir)
  if (!artifacts.length) return null
  const typeOrder = preferredType
    ? [preferredType, ...Object.keys(TYPE_EXTENSIONS).filter((type) => type !== preferredType)]
    : ['html', 'svg', 'markdown']
  for (const type of typeOrder) {
    const candidates = artifacts.filter((artifact) => artifact.type === type).sort(compareArtifacts)
    if (candidates.length) return candidates[0]
  }
  return null
}

