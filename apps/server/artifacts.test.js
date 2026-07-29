import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  allocateRunFolder,
  artifactTypeForEntry,
  expectedArtifactType,
  findArtifact,
  normalizeDeliveryMode,
} from './artifacts.js'

const withFiles = (files, callback) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'touchstone-artifacts-'))
  try {
    for (const file of files) {
      const absolute = path.join(root, file)
      fs.mkdirSync(path.dirname(absolute), { recursive: true })
      fs.writeFileSync(absolute, file)
    }
    callback(root)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

test('maps delivery modes and artifact extensions', () => {
  assert.equal(normalizeDeliveryMode('single-svg'), 'single-svg')
  assert.equal(normalizeDeliveryMode('unknown'), 'single-html')
  assert.equal(expectedArtifactType('single-markdown'), 'markdown')
  assert.equal(expectedArtifactType('custom'), null)
  assert.equal(artifactTypeForEntry('PLAN.MD'), 'markdown')
  assert.equal(artifactTypeForEntry('result.svg'), 'svg')
})

test('prefers the requested artifact type and its conventional root filename', () => {
  withFiles(['nested/index.html', 'notes.md', 'plan.md', 'result.svg'], (root) => {
    assert.deepEqual(findArtifact(root, 'markdown'), {
      entry: 'plan.md',
      type: 'markdown',
      depth: 0,
    })
    assert.deepEqual(findArtifact(root, 'svg'), {
      entry: 'result.svg',
      type: 'svg',
      depth: 0,
    })
  })
})

test('falls back to another supported artifact when the requested type is missing', () => {
  withFiles(['proposal.md'], (root) => {
    assert.equal(findArtifact(root, 'html')?.entry, 'proposal.md')
    assert.equal(findArtifact(root, 'html')?.type, 'markdown')
  })
})

test('gives every run in a batch its own folder, including queued ones', () => {
  // 排队中的 run 还没建目录，所以只靠文件系统判重会让它们撞在一起。
  const claimed = new Set()
  const exists = () => false
  const folders = Array.from({ length: 4 }, () =>
    allocateRunFolder('demo', 'claude-haiku', { claimed, exists })
  )
  assert.deepEqual(folders, [
    'demo/claude-haiku',
    'demo/claude-haiku_2',
    'demo/claude-haiku_3',
    'demo/claude-haiku_4',
  ])
  assert.equal(new Set(folders).size, folders.length)
})

test('skips folders that already exist on disk', () => {
  const onDisk = new Set(['claude-haiku', 'claude-haiku_2'])
  assert.equal(
    allocateRunFolder('demo', 'claude-haiku', {
      claimed: new Set(),
      exists: (_project, name) => onDisk.has(name),
    }),
    'demo/claude-haiku_3'
  )
})

test('scopes folder claims to their project', () => {
  const claimed = new Set(['other/claude-haiku'])
  assert.equal(
    allocateRunFolder('demo', 'claude-haiku', { claimed, exists: () => false }),
    'demo/claude-haiku'
  )
})
