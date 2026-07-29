import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareVersions,
  parseCliVersion,
  probeAgentCapability,
  probeAgentCapabilityAsync,
  validateAgentSelection,
} from './agent-capabilities.js'

const baseAgent = {
  id: 'codex',
  name: 'Codex CLI',
  command: '/bin/sh',
  models: ['gpt-5.5', 'gpt-5.6-sol'],
  modelRequirements: {
    'gpt-5.6-sol': { minimumVersion: '0.143.0' },
  },
  auth: { files: ['~/.codex/auth.json'] },
}

test('parses versions and compares numeric components', () => {
  assert.equal(parseCliVersion('codex-cli 0.137.0'), '0.137.0')
  assert.equal(parseCliVersion('OpenCode v1.14.21'), '1.14.21')
  assert.equal(compareVersions('0.137.0', '0.143.0'), -1)
  assert.equal(compareVersions('2.1.200', '2.1.20'), 1)
})

test('marks a model unavailable when its CLI is too old', () => {
  const capability = probeAgentCapability(baseAgent, {
    env: { PATH: '/bin' },
    homeDir: '/home/test',
    existsSync: (value) => value === '/home/test/.codex/auth.json',
    runCommand: () => ({ status: 0, stdout: 'codex-cli 0.137.0\n', stderr: '' }),
  })

  assert.equal(capability.health.ready, true)
  assert.equal(capability.health.modelHealth['gpt-5.5'].available, true)
  assert.equal(capability.health.modelHealth['gpt-5.6-sol'].available, false)
  assert.match(validateAgentSelection(baseAgent, capability, 'gpt-5.6-sol'), /0\.143\.0/)
})

test('does not claim readiness when the version probe hangs', () => {
  const capability = probeAgentCapability(
    baseAgent,
    {
      env: { PATH: '/bin' },
      existsSync: () => true,
      runCommand: () => ({ status: null, error: { code: 'ETIMEDOUT' }, stdout: '', stderr: '' }),
    }
  )

  assert.equal(capability.health.installed, true)
  assert.equal(capability.health.compatible, false)
  assert.equal(capability.health.ready, false)
  assert.match(capability.health.fix, /超时/)
})

test('treats a logged-out credential file as unauthenticated', () => {
  // Gemini CLI 登出后仍保留 google_accounts.json，只是 active 变成 null。
  const geminiAgent = {
    id: 'gemini',
    name: 'Gemini CLI',
    command: '/bin/sh',
    models: ['gemini-3.1-pro'],
    auth: {
      files: [{ path: '~/.gemini/google_accounts.json', requireJsonField: 'active' }],
    },
  }
  const probe = (accountsJson) =>
    probeAgentCapability(geminiAgent, {
      env: { PATH: '/bin' },
      homeDir: '/home/test',
      existsSync: (value) => value === '/home/test/.gemini/google_accounts.json',
      readFileSync: () => accountsJson,
      runCommand: () => ({ status: 0, stdout: '0.33.1\n', stderr: '' }),
    })

  const loggedOut = probe('{"active": null, "old": [{"email": "a@b.c"}]}')
  assert.equal(loggedOut.health.installed, true)
  assert.equal(loggedOut.health.authed, false)
  assert.equal(loggedOut.health.ready, false)

  const loggedIn = probe('{"active": {"email": "a@b.c"}}')
  assert.equal(loggedIn.health.authed, true)
  assert.equal(loggedIn.health.ready, true)
})

test('supports asynchronous non-blocking probes', async () => {
  const capability = await probeAgentCapabilityAsync(baseAgent, {
    env: { PATH: '/bin' },
    homeDir: '/home/test',
    existsSync: () => true,
    runCommandAsync: async () => ({ status: 0, stdout: 'codex-cli 0.143.0\n', stderr: '' }),
  })

  assert.equal(capability.health.ready, true)
  assert.equal(capability.health.modelHealth['gpt-5.6-sol'].available, true)
})
