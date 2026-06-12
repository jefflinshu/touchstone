import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import crypto from 'node:crypto'

function decryptChromiumCookie({ encryptedValueHex, host, key, dbVersion }) {
  const encrypted = Buffer.from(encryptedValueHex, 'hex')
  if (encrypted.subarray(0, 3).toString('utf8') !== 'v10') return null

  const iv = Buffer.alloc(16, ' ')
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
  const decrypted = Buffer.concat([decipher.update(encrypted.subarray(3)), decipher.final()])

  if (dbVersion >= 24 && decrypted.length > 32) {
    const hostDigest = crypto.createHash('sha256').update(host).digest()
    if (decrypted.subarray(0, 32).equals(hostDigest)) return decrypted.subarray(32).toString('utf8')
  }

  return decrypted.toString('utf8')
}

function readCometCookies(cookieFile) {
  const meta = execFileSync('sqlite3', [cookieFile, "select value from meta where key = 'version'"], {
    encoding: 'utf8',
  }).trim()
  const dbVersion = Number(meta) || 0

  const rows = execFileSync(
    'sqlite3',
    [
      cookieFile,
      "select host_key,name,hex(encrypted_value) from cookies where (host_key like '%x.com%' or host_key like '%twitter.com%') and name in ('auth_token','ct0')",
    ],
    { encoding: 'utf8' }
  ).trim()

  if (!rows) return null

  const password = execFileSync(
    'security',
    ['find-generic-password', '-a', 'Comet', '-s', 'Comet Safe Storage', '-w'],
    { encoding: 'utf8' }
  ).trim()
  const key = crypto.pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1')

  const cookies = {}
  for (const row of rows.split('\n')) {
    const [host, name, encryptedValueHex] = row.split('|')
    if (!host || !name || !encryptedValueHex) continue
    const value = decryptChromiumCookie({ encryptedValueHex, host, key, dbVersion })
    if (value) cookies[name] = value
  }

  return cookies.auth_token && cookies.ct0 ? cookies : null
}

export function loadTwitterAuthEnv() {
  if (process.env.TWITTER_AUTH_TOKEN && process.env.TWITTER_CT0) return false
  if (platform() !== 'darwin') return false

  const cookieFile =
    process.env.TWITTER_COMET_COOKIE_FILE || join(homedir(), 'Library', 'Application Support', 'Comet', 'Default', 'Cookies')
  if (!existsSync(cookieFile)) return false

  try {
    const cookies = readCometCookies(cookieFile)
    if (!cookies) return false
    process.env.TWITTER_AUTH_TOKEN = cookies.auth_token
    process.env.TWITTER_CT0 = cookies.ct0
    return true
  } catch {
    return false
  }
}
