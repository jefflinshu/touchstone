import assert from 'node:assert/strict'
import test from 'node:test'
import { ModelCatalog, normalizeModelsDevCatalog } from './model-catalog.js'

test('normalizes models.dev provider metadata for the model picker', () => {
  const catalog = normalizeModelsDevCatalog(
    {
      zenmux: {
        name: 'ZenMux',
        api: 'https://zenmux.ai/api/v1',
        models: {
          'old/model': { name: 'Old', status: 'deprecated', tool_call: true },
          'openai/gpt-x': {
            name: 'GPT X',
            reasoning: true,
            tool_call: true,
            attachment: true,
            last_updated: '2026-07-20',
            limit: { context: 400000, output: 128000 },
          },
        },
      },
    },
    'zenmux'
  )
  assert.equal(catalog.providerId, 'zenmux')
  assert.equal(catalog.models.length, 1)
  assert.deepEqual(catalog.models[0], {
    id: 'openai/gpt-x',
    name: 'GPT X',
    family: '',
    reasoning: true,
    toolCall: true,
    attachment: true,
    status: '',
    releaseDate: '',
    lastUpdated: '2026-07-20',
    context: 400000,
    output: 128000,
  })
})

test('caches models.dev responses for repeated provider lookups', async () => {
  let calls = 0
  const catalog = new ModelCatalog({
    now: () => 100,
    fetchJson: async () => {
      calls += 1
      return { zenmux: { name: 'ZenMux', models: {} } }
    },
  })
  await catalog.provider('zenmux')
  await catalog.provider('zenmux')
  assert.equal(calls, 1)
})
