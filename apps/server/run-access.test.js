import assert from 'node:assert/strict'
import test from 'node:test'
import { canManageRun, canReadRun, isRunPublished, visibleRunsFor } from './run-access.js'

const privateRun = { id: 'private', user: 'owner@example.com', publish: false }
const pendingPublish = { id: 'pending', user: 'owner@example.com', publish: true }
const publishedRun = { id: 'public', user: 'owner@example.com', publish: true, publishState: 'published' }

test('publish intent is private until publication succeeds', () => {
  assert.equal(isRunPublished(pendingPublish), false)
  assert.equal(canReadRun(pendingPublish, null), false)
  assert.equal(canReadRun(publishedRun, null), true)
})

test('owners can read and manage their private runs', () => {
  assert.equal(canReadRun(privateRun, 'owner@example.com'), true)
  assert.equal(canManageRun(privateRun, 'owner@example.com'), true)
  assert.equal(canManageRun(publishedRun, 'viewer@example.com'), false)
})

test('run lists contain public runs plus the current owners private runs', () => {
  assert.deepEqual(
    visibleRunsFor([privateRun, pendingPublish, publishedRun], 'viewer@example.com').map((run) => run.id),
    ['public']
  )
  assert.deepEqual(
    visibleRunsFor([privateRun, pendingPublish, publishedRun], 'owner@example.com').map((run) => run.id),
    ['private', 'pending', 'public']
  )
})
