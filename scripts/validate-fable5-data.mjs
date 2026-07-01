import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const WEB_DIR = join(ROOT, 'apps', 'web')
const DATA_DIR = join(WEB_DIR, 'public', 'fable5-data')
const PUBLIC_DIR = join(WEB_DIR, 'public')

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function fail(message) {
  console.error(`[fable5:validate] ${message}`)
  process.exitCode = 1
}

function rowsFromPayload(payload) {
  return Array.isArray(payload) ? payload : payload.items || []
}

const indexPath = join(DATA_DIR, 'index.json')
if (!existsSync(indexPath)) {
  fail('missing index.json')
  process.exit()
}

const index = readJson(indexPath)
const pages = Array.isArray(index.pages) && index.pages.length ? index.pages : []
if (!pages.length) fail('index.pages is required and must not be empty')

let pageRows = []
for (const [pageIndex, page] of pages.entries()) {
  if (!page.file) {
    fail(`pages[${pageIndex}] is missing file`)
    continue
  }
  const abs = join(DATA_DIR, page.file)
  if (!existsSync(abs)) {
    fail(`missing page file: ${page.file}`)
    continue
  }
  const rows = rowsFromPayload(readJson(abs))
  if (rows.length !== page.count) fail(`${page.file} count mismatch: index=${page.count}, file=${rows.length}`)
  pageRows.push(...rows)
  if (page.fromDate && rows[0]?.date !== page.fromDate) fail(`${page.file} fromDate mismatch: index=${page.fromDate}, file=${rows[0]?.date || 'empty'}`)
  if (page.toDate && rows.at(-1)?.date !== page.toDate) fail(`${page.file} toDate mismatch: index=${page.toDate}, file=${rows.at(-1)?.date || 'empty'}`)
}

if (index.total !== pageRows.length) fail(`total mismatch: index=${index.total}, pages=${pageRows.length}`)

const bySource = new Set()
for (const item of pageRows) {
  if (!item.id) fail('item missing id')
  if (!item.sourceUrl) fail(`${item.id || 'unknown'} missing sourceUrl`)
  if (!item.date) fail(`${item.id || item.sourceUrl || 'unknown'} missing date`)
  if (bySource.has(item.sourceUrl)) fail(`duplicate sourceUrl: ${item.sourceUrl}`)
  bySource.add(item.sourceUrl)
  for (const key of ['mediaThumbUrl', 'avatarUrl']) {
    const value = item[key]
    if (typeof value === 'string' && value.startsWith('/') && !existsSync(join(PUBLIC_DIR, value))) {
      fail(`${item.id} missing referenced ${key}: ${value}`)
    }
  }
}

for (let i = 1; i < pageRows.length; i += 1) {
  const prev = pageRows[i - 1]
  const cur = pageRows[i]
  if (String(prev.date || '').localeCompare(String(cur.date || '')) < 0) {
    fail(`pages are not date-desc sorted at ${i - 1}/${i}: ${prev.date} before ${cur.date}`)
    break
  }
}

const computedCategories = new Map()
for (const item of pageRows) {
  const categories = Array.isArray(item.categories) && item.categories.length ? item.categories : [item.scene || 'other']
  for (const key of categories) computedCategories.set(key, (computedCategories.get(key) || 0) + 1)
}
for (const { key, count } of index.categoryCounts || []) {
  const actual = computedCategories.get(key) || 0
  if (actual !== count) fail(`category ${key} mismatch: index=${count}, actual=${actual}`)
  computedCategories.delete(key)
}
for (const [key, count] of computedCategories) fail(`category ${key} missing from index.categoryCounts: actual=${count}`)

for (const shard of index.shards || []) {
  const abs = join(DATA_DIR, shard.file)
  if (!existsSync(abs)) {
    fail(`missing shard file: ${shard.file}`)
    continue
  }
  const rows = rowsFromPayload(readJson(abs))
  if (rows.length !== shard.count) fail(`${shard.file} count mismatch: index=${shard.count}, file=${rows.length}`)
}

if (!process.exitCode) {
  console.log(
    `[fable5:validate] ok: ${index.total} items, ${pages.length} pages, ${index.shards?.length || 0} date shards`
  )
}
