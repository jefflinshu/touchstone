import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  MAX_SELECTED_SKILLS,
  agentLoadsSkills,
  buildSelectedSkillsPrefix,
  discoverInstalledSkills,
  installBundledSkill,
  mergeSkillCatalog,
  normalizeDeliveryConstraint,
  parseSkillFrontmatter,
  selectedSkillIssues,
  skillInstallerArgs,
  skillTargetSummary,
} from './skill-registry.js'

test('parses standard SKILL.md frontmatter', () => {
  assert.deepEqual(
    parseSkillFrontmatter('---\nname: frontend-design\ndescription: Build polished interfaces.\n---\n# Skill'),
    {
      id: 'frontend-design',
      name: 'frontend-design',
      description: 'Build polished interfaces.',
    }
  )
})

test('discovers local skills per agent without reading arbitrary files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'touchstone-skills-'))
  fs.mkdirSync(path.join(root, '.codex/skills/demo'), { recursive: true })
  fs.writeFileSync(path.join(root, '.codex/skills/demo/SKILL.md'), '---\nname: demo\ndescription: Demo skill.\n---\n')
  const skills = discoverInstalledSkills({ homeDir: root })
  assert.equal(skills.length, 1)
  assert.deepEqual(skills[0].installedFor, ['codex'])
  fs.rmSync(root, { recursive: true, force: true })
})

test('requires the skill to be installed for the agents that can load it', () => {
  const skills = [{ id: 'demo', installedFor: ['claude'] }]
  assert.deepEqual(selectedSkillIssues(['demo'], skills, ['claude']), [])
  // codex 反正不会加载它，所以混选 codex 不该拦住任务。
  assert.deepEqual(selectedSkillIssues(['demo'], skills, ['claude', 'codex']), [])
  // 但 claude 自己没装就是真错误。
  assert.match(
    selectedSkillIssues(['demo'], [{ id: 'demo', installedFor: ['codex'] }], ['claude', 'codex']).join(' '),
    /尚未安装/
  )
})

test('rejects skills when no selected agent can deterministically load them', () => {
  const skills = [{ id: 'demo', installedFor: ['codex'] }]
  // 装在 codex 目录下也不算就绪：codex 不会展开 `/demo`，只能靠模型自觉。
  assert.match(selectedSkillIssues(['demo'], skills, ['codex']).join(' '), /无法在所选 Agent 上确定性加载/)
})

test('reports which agents load the skill and which skip it', () => {
  assert.deepEqual(skillTargetSummary(['demo'], ['claude', 'codex', 'gemini']), {
    loadedBy: ['claude'],
    skippedBy: ['codex', 'gemini'],
  })
  assert.deepEqual(skillTargetSummary([], ['claude']), { loadedBy: [], skippedBy: [] })
})

test('only prefixes the slash command for agents that expand it', () => {
  const body = '用户任务'
  const promptFor = (agentId) =>
    (agentLoadsSkills(agentId) ? buildSelectedSkillsPrefix(['demo']) : '') + body
  assert.equal(promptFor('claude'), '/demo\n\n用户任务')
  // codex 不该收到一个它读不懂的字面 `/demo`。
  assert.equal(promptFor('codex'), '用户任务')
})

test('caps selected skills at the deterministically loadable count', () => {
  const skills = [
    { id: 'a', installedFor: ['claude'] },
    { id: 'b', installedFor: ['claude'] },
  ]
  assert.equal(MAX_SELECTED_SKILLS, 1)
  assert.match(selectedSkillIssues(['a', 'b'], skills, ['claude']).join(' '), /最多挂载 1 个/)
})

test('puts the selected skill slash command at the very start of the prompt', () => {
  // 实测：`/<skill>` 只有作为 prompt 的第一个 token 才会被 CLI 展开，
  // 放在末尾或仅在文中点名都不会加载 SKILL.md 正文。
  assert.equal(buildSelectedSkillsPrefix(['demo']), '/demo\n\n')
  assert.equal(buildSelectedSkillsPrefix([]), '')
  const finalPrompt = `${buildSelectedSkillsPrefix(['demo'])}用户任务`
  assert.equal(finalPrompt.startsWith('/demo'), true)
})

test('marks a skill loadable only when installed for a slash-capable agent', () => {
  const merged = mergeSkillCatalog([], [
    { id: 'claude-only', name: 'claude-only', installedFor: ['claude'] },
    { id: 'codex-only', name: 'codex-only', installedFor: ['codex'] },
  ])
  assert.equal(merged.find((skill) => skill.id === 'claude-only').loadable, true)
  assert.equal(merged.find((skill) => skill.id === 'codex-only').loadable, false)
  // 可加载的排在前面，`/` 选择器第一屏即为可用项。
  assert.equal(merged[0].id, 'claude-only')
})

test('builds allowlisted skills CLI arguments', () => {
  assert.deepEqual(
    skillInstallerArgs(
      { sourceType: 'skills-cli', source: 'vercel-labs/agent-skills', skill: 'frontend-design' },
      ['codex', 'claude']
    ),
    [
      '--yes',
      'skills',
      'add',
      'vercel-labs/agent-skills',
      '--skill',
      'frontend-design',
      '--global',
      '--copy',
      '--yes',
      '--agent',
      'codex',
      '--agent',
      'claude-code',
    ]
  )
})

test('installs a bundled skill only into known agent roots', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'touchstone-skill-source-'))
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'touchstone-skill-home-'))
  fs.mkdirSync(path.join(workspaceRoot, 'skills/demo'), { recursive: true })
  fs.writeFileSync(path.join(workspaceRoot, 'skills/demo/SKILL.md'), '---\nname: demo\ndescription: Demo.\n---\n')
  installBundledSkill(
    { id: 'demo', sourceType: 'bundled', source: 'skills/demo' },
    ['codex', 'claude'],
    { workspaceRoot, homeDir }
  )
  assert.equal(fs.existsSync(path.join(homeDir, '.codex/skills/demo/SKILL.md')), true)
  assert.equal(fs.existsSync(path.join(homeDir, '.claude/skills/demo/SKILL.md')), true)
  fs.rmSync(workspaceRoot, { recursive: true, force: true })
  fs.rmSync(homeDir, { recursive: true, force: true })
})

test('normalizes an editable delivery constraint with a fallback and cap', () => {
  assert.equal(normalizeDeliveryConstraint('  custom  ', 'fallback'), 'custom')
  assert.equal(normalizeDeliveryConstraint('', 'fallback'), 'fallback')
  assert.equal(normalizeDeliveryConstraint('123456', '', 4), '1234')
})
