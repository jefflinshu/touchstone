import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  ProviderRegistry,
  listProviderPresets,
  modelDiscoveryUrls,
  normalizeProviderModels,
  parseDiscoveredModels,
  providerRuntimeEnv,
} from './provider-registry.js'

test('stores provider credentials privately and preserves an omitted token on update', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'touchstone-providers-'))
  const file = path.join(root, 'providers.json')
  let tick = 0
  const registry = new ProviderRegistry(file, {
    id: () => 'provider-1',
    now: () => `2026-07-27T00:00:0${tick++}.000Z`,
  })
  const created = registry.upsert('owner@example.com', {
    name: 'Model Gateway',
    baseUrl: 'https://gateway.example.com/',
    authMode: 'auth-token',
    credential: 'secret-token',
    models: ['openai/gpt-x', 'google/gemini-pro'],
  })
  assert.equal(created.hasCredential, true)
  assert.equal('credential' in created, false)
  assert.equal(fs.statSync(file).mode & 0o777, 0o600)

  const updated = registry.upsert('owner@example.com', {
    id: created.id,
    name: 'Updated Gateway',
    baseUrl: 'https://gateway.example.com',
    authMode: 'auth-token',
    credential: '',
    models: ['deepseek/deepseek-v4'],
  })
  assert.equal(updated.name, 'Updated Gateway')
  assert.equal(registry.resolve('owner@example.com', created.id).credential, 'secret-token')
  assert.equal(registry.resolve('other@example.com', created.id), null)
})

test('locks the ZenMux Coding Plan preset to its official Anthropic endpoint', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'touchstone-providers-'))
  const registry = new ProviderRegistry(path.join(root, 'providers.json'), {
    id: () => 'zenmux-1',
    now: () => '2026-07-27T00:00:00.000Z',
  })
  const created = registry.upsert('owner@example.com', {
    presetId: 'zenmux-coding-plan',
    credential: 'zenmux-token',
    baseUrl: 'https://malicious.example.com',
  })
  assert.equal(created.name, 'ZenMux Coding Plan')
  assert.equal(created.baseUrl, 'https://zenmux.ai/api/anthropic')
  assert.equal(created.authMode, 'auth-token')
  assert.equal(created.catalogProviderId, 'zenmux')
  assert.equal(listProviderPresets()[0].id, 'zenmux-coding-plan')
})

test('builds strict Claude Code model environment without leaking the other auth mode', () => {
  const env = providerRuntimeEnv(
    {
      baseUrl: 'https://gateway.example.com',
      authMode: 'auth-token',
      credential: 'token',
    },
    'openai/gpt-x',
    true
  )
  assert.equal(env.ANTHROPIC_AUTH_TOKEN, 'token')
  assert.equal(env.ANTHROPIC_API_KEY, '')
  assert.equal(env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS, '1')
  assert.equal(env.CLAUDE_CODE_ATTRIBUTION_HEADER, '0')
  assert.equal(env.ANTHROPIC_DEFAULT_OPUS_MODEL, 'openai/gpt-x')
  assert.equal(env.ANTHROPIC_DEFAULT_SONNET_MODEL, 'openai/gpt-x')
  assert.equal(env.ANTHROPIC_DEFAULT_HAIKU_MODEL, 'openai/gpt-x')
  assert.equal(env.CLAUDE_CODE_SUBAGENT_MODEL, 'openai/gpt-x')
})

test('normalizes model catalogs and common discovery responses', () => {
  assert.deepEqual(normalizeProviderModels('openai/gpt-x, openai/gpt-x\n google/gemini-pro'), [
    'openai/gpt-x',
    'google/gemini-pro',
  ])
  assert.deepEqual(parseDiscoveredModels({ data: [{ id: 'openai/gpt-x' }, { id: 'google/gemini-pro' }] }), [
    'openai/gpt-x',
    'google/gemini-pro',
  ])
  assert.deepEqual(modelDiscoveryUrls('https://gateway.example.com/v1'), [
    'https://gateway.example.com/v1/models',
  ])
})
