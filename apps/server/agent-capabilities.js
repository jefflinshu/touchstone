import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const VERSION_PATTERN = /(?:^|\s|v)(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/m
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g

export function parseCliVersion(output) {
  return String(output || '').match(VERSION_PATTERN)?.[1] || null
}

function versionParts(version) {
  return String(version || '')
    .split(/[+-]/, 1)[0]
    .split('.')
    .map((part) => Number(part) || 0)
}

export function compareVersions(left, right) {
  const a = versionParts(left)
  const b = versionParts(right)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0)
    if (delta) return delta < 0 ? -1 : 1
  }
  return 0
}

export function findExecutable(command, envPath = process.env.PATH || '') {
  const value = String(command || '').trim()
  if (!value) return null
  if (value.includes(path.sep)) {
    try {
      fs.accessSync(value, fs.constants.X_OK)
      return value
    } catch {
      return null
    }
  }
  for (const folder of envPath.split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(folder, value)
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      return candidate
    } catch {}
  }
  return null
}

function expandHome(value, homeDir) {
  return String(value || '').replace(/^~(?=$|\/|\\)/, homeDir)
}

function checkAuth(agent, { env, homeDir, existsSync }) {
  const auth = agent.auth || {}
  const files = Array.isArray(auth.files) ? auth.files : []
  const variables = Array.isArray(auth.env) ? auth.env : []
  if (!files.length && !variables.length) return true
  if (files.some((file) => existsSync(expandHome(file, homeDir)))) return true
  return variables.some((key) => Boolean(env[key]))
}

function defaultRun(executable, args, { timeoutMs, env }) {
  return spawnSync(executable, args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    env: { ...env, FORCE_COLOR: '0', NO_COLOR: '1' },
  })
}

function defaultRunAsync(executable, args, { timeoutMs, env }) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      env: { ...env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    let timer = null
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, ...result })
    }
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => finish({ status: null, error }))
    child.on('close', (status) => finish({ status, error: null }))
    timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish({ status: null, error: Object.assign(new Error('probe timeout'), { code: 'ETIMEDOUT' }) })
    }, timeoutMs)
    timer.unref()
  })
}

function cleanOutput(result) {
  return `${result?.stdout || ''}\n${result?.stderr || ''}`.replace(ANSI_PATTERN, '').trim()
}

function probeVersion(agent, executable, options) {
  const args = Array.isArray(agent.versionArgs) ? agent.versionArgs : ['--version']
  const result = options.runCommand(executable, args, options)
  const output = cleanOutput(result)
  const version = parseCliVersion(output)
  const timedOut = result?.error?.code === 'ETIMEDOUT'
  if (timedOut) return { version: null, error: `${agent.command} --version 超时` }
  if (result?.error && !version) return { version: null, error: result.error.message || String(result.error) }
  if (typeof result?.status === 'number' && result.status !== 0 && !version) {
    return { version: null, error: output.split('\n').filter(Boolean).at(-1) || `exit ${result.status}` }
  }
  if (!version) return { version: null, error: `无法识别 ${agent.command} 版本` }
  return { version, error: null }
}

async function probeVersionAsync(agent, executable, options) {
  const args = Array.isArray(agent.versionArgs) ? agent.versionArgs : ['--version']
  const result = await options.runCommandAsync(executable, args, options)
  const output = cleanOutput(result)
  const version = parseCliVersion(output)
  const timedOut = result?.error?.code === 'ETIMEDOUT'
  if (timedOut) return { version: null, error: `${agent.command} --version 超时` }
  if (result?.error && !version) return { version: null, error: result.error.message || String(result.error) }
  if (typeof result?.status === 'number' && result.status !== 0 && !version) {
    return { version: null, error: output.split('\n').filter(Boolean).at(-1) || `exit ${result.status}` }
  }
  if (!version) return { version: null, error: `无法识别 ${agent.command} 版本` }
  return { version, error: null }
}

function discoverModels(agent, executable, options) {
  if (!Array.isArray(agent.modelsCommand) || !agent.modelsCommand.length) {
    return { models: [], error: null }
  }
  const result = options.runCommand(executable, agent.modelsCommand, options)
  const output = cleanOutput(result)
  if (result?.error?.code === 'ETIMEDOUT') return { models: [], error: '模型探测超时' }
  if (typeof result?.status === 'number' && result.status !== 0) {
    return { models: [], error: output.split('\n').filter(Boolean).at(-1) || `exit ${result.status}` }
  }
  return {
    models: [
      ...new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:/-]+$/.test(line))
      ),
    ],
    error: null,
  }
}

async function discoverModelsAsync(agent, executable, options) {
  if (!Array.isArray(agent.modelsCommand) || !agent.modelsCommand.length) {
    return { models: [], error: null }
  }
  const result = await options.runCommandAsync(executable, agent.modelsCommand, options)
  const output = cleanOutput(result)
  if (result?.error?.code === 'ETIMEDOUT') return { models: [], error: '模型探测超时' }
  if (typeof result?.status === 'number' && result.status !== 0) {
    return { models: [], error: output.split('\n').filter(Boolean).at(-1) || `exit ${result.status}` }
  }
  return {
    models: [
      ...new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:/-]+$/.test(line))
      ),
    ],
    error: null,
  }
}

function finishCapability(agent, executable, authed, versionProbe, discovery) {
  const installed = Boolean(executable)
  const minimumVersion = agent.minimumVersion || null
  const compatible =
    installed &&
    Boolean(versionProbe.version) &&
    (!minimumVersion || compareVersions(versionProbe.version, minimumVersion) >= 0)
  const modelHealth = {}
  for (const model of agent.models || []) {
    const requirement = agent.modelRequirements?.[model] || {}
    const requiredVersion = requirement.minimumVersion || null
    const available =
      compatible &&
      (!requiredVersion || compareVersions(versionProbe.version, requiredVersion) >= 0)
    modelHealth[model] = {
      available,
      minimumVersion: requiredVersion,
      fix: available
        ? null
        : requiredVersion
          ? `${model} 需要 ${agent.name} ${requiredVersion} 或更新版本；当前是 ${versionProbe.version || '未知版本'}`
          : versionProbe.error,
    }
  }
  const modelDiscoveryReady =
    !agent.modelsRequired || (!discovery.error && discovery.models.length > 0)
  const installCommand = agent.install?.cmd ? `，可运行：${agent.install.cmd}` : ''
  let fix = null
  if (!installed) fix = `未检测到 ${agent.command} 命令，请先安装${installCommand}`
  else if (!versionProbe.version) fix = `${versionProbe.error}；请修复或升级 ${agent.name}`
  else if (!compatible) fix = `${agent.name} ${versionProbe.version} 低于最低支持版本 ${minimumVersion}`
  else if (!authed) fix = agent.auth?.loginHint || '请先完成 CLI 登录'
  else if (!modelDiscoveryReady) fix = discovery.error || `${agent.name} 没有返回可用模型`

  return {
    executable,
    discoveredModels: discovery.models,
    health: {
      installed,
      authed,
      compatible,
      ready: installed && authed && compatible && modelDiscoveryReady,
      version: versionProbe.version,
      protocol: agent.protocol || 'cli-jsonl',
      probeError: versionProbe.error,
      modelDiscoveryError: discovery.error,
      modelHealth,
      fix,
    },
  }
}

export function probeAgentCapability(agent, overrides = {}) {
  const options = {
    env: overrides.env || process.env,
    homeDir: overrides.homeDir || os.homedir(),
    existsSync: overrides.existsSync || fs.existsSync,
    runCommand: overrides.runCommand || defaultRun,
    timeoutMs: overrides.timeoutMs || Number(agent.probeTimeoutMs || 3000),
  }
  const executable = findExecutable(agent.command, options.env.PATH || '')
  const installed = Boolean(executable)
  const authed = installed && checkAuth(agent, options)
  const versionProbe = installed ? probeVersion(agent, executable, options) : { version: null, error: null }
  const compatible =
    installed &&
    Boolean(versionProbe.version) &&
    (!agent.minimumVersion || compareVersions(versionProbe.version, agent.minimumVersion) >= 0)
  const discovery = installed && compatible ? discoverModels(agent, executable, options) : { models: [], error: null }
  return finishCapability(agent, executable, authed, versionProbe, discovery)
}

export async function probeAgentCapabilityAsync(agent, overrides = {}) {
  const options = {
    env: overrides.env || process.env,
    homeDir: overrides.homeDir || os.homedir(),
    existsSync: overrides.existsSync || fs.existsSync,
    runCommandAsync: overrides.runCommandAsync || defaultRunAsync,
    timeoutMs: overrides.timeoutMs || Number(agent.probeTimeoutMs || 3000),
  }
  const executable = findExecutable(agent.command, options.env.PATH || '')
  const installed = Boolean(executable)
  const authed = installed && checkAuth(agent, options)
  const versionProbe = installed ? await probeVersionAsync(agent, executable, options) : { version: null, error: null }
  const compatible =
    installed &&
    Boolean(versionProbe.version) &&
    (!agent.minimumVersion || compareVersions(versionProbe.version, agent.minimumVersion) >= 0)
  const discovery = installed && compatible ? await discoverModelsAsync(agent, executable, options) : { models: [], error: null }
  return finishCapability(agent, executable, authed, versionProbe, discovery)
}

export function validateAgentSelection(agent, capability, model) {
  if (!capability.health.ready) return capability.health.fix || `${agent.name} 当前不可用`
  const selected = String(model || '').trim()
  const status = selected ? capability.health.modelHealth[selected] : null
  if (status && !status.available) return status.fix || `${selected} 当前不可用`
  return null
}
