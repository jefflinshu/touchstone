import assert from 'node:assert/strict'
import test from 'node:test'
import { describeRunner, parseRunnerOwners, resolveRunnerAccess } from './runner-access.js'

test('normalizes configured runner owner emails', () => {
  assert.deepEqual([...parseRunnerOwners(' Owner@Example.com, second@example.com ,,')], [
    'owner@example.com',
    'second@example.com',
  ])
})

test('only an allowlisted session can execute a restricted runner', () => {
  assert.equal(resolveRunnerAccess('owner@example.com', 'OWNER@example.com').canExecute, true)
  assert.equal(resolveRunnerAccess('visitor@example.com', 'owner@example.com').canExecute, false)
  assert.equal(resolveRunnerAccess(null, 'owner@example.com').canExecute, false)
})

test('runner descriptor never grants execution while the runner is offline', () => {
  assert.deepEqual(
    describeRunner({
      email: 'owner@example.com',
      ownerList: 'owner@example.com',
      label: "Jeff's Mac",
      online: false,
    }),
    {
      online: false,
      connected: false,
      canExecute: false,
      restricted: true,
      pairingAvailable: false,
      label: "Jeff's Mac",
      transport: 'protected-edge-origin',
    }
  )
})
