import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  buildSelectedSkillsPrompt,
  discoverInstalledSkills,
  installBundledSkill,
  normalizeDeliveryConstraint,
  parseSkillFrontmatter,
  selectedSkillIssues,
  skillInstallerArgs,
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

test('requires selected skills to exist on every selected runner', () => {
  const skills = [{ id: 'demo', installedFor: ['codex'] }]
  assert.deepEqual(selectedSkillIssues(['demo'], skills, ['codex']), [])
  assert.match(selectedSkillIssues(['demo'], skills, ['codex', 'claude'])[0], /claude/)
  assert.match(buildSelectedSkillsPrompt(['demo']), /demo/)
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
