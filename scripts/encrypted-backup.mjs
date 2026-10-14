// Offline logical database backup. It does NOT contain Storage object bytes,
// provider configuration, secrets, or point-in-time recovery. See the runbook.
import { execFileSync } from 'node:child_process'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { Buffer } from 'node:buffer'
import { pathToFileURL } from 'node:url'

export function encryptBackup(payload, key) {
  if (key.length !== 32) throw new Error('A 32-byte backup encryption key is required.')
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv)
  const header = Buffer.from('QUANTUM-HRMS-BACKUP-v1\n')
  cipher.setAAD(header)
  const data = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(payload))), cipher.final()])
  return Buffer.concat([header, iv, cipher.getAuthTag(), data])
}
export function decryptBackup(bytes, key) {
  const header = Buffer.from('QUANTUM-HRMS-BACKUP-v1\n'), offset = header.length
  if (!bytes.subarray(0, offset).equals(header)) throw new Error('Unrecognized backup format.')
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(offset, offset + 12))
  decipher.setAAD(header); decipher.setAuthTag(bytes.subarray(offset + 12, offset + 28))
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(offset + 28)), decipher.final()]).toString())
}

async function main() {
  const args = globalThis.process.argv.slice(2), local = args.includes('--local')
  const target = args.find(arg => !arg.startsWith('--'))
  if (!target || !globalThis.process.env.HRMS_BACKUP_KEY) throw new Error('Usage: HRMS_BACKUP_KEY=<base64 key> node scripts/encrypted-backup.mjs [--local] [--verify] <encrypted-file>')
  const key = Buffer.from(globalThis.process.env.HRMS_BACKUP_KEY, 'base64')
  if (key.length !== 32) throw new Error('Invalid encryption key length.')
  const path = resolve(target)
  if (args.includes('--verify')) {
    const restored = decryptBackup(await readFile(path), key)
    if (!restored.schema?.includes('CREATE') || !restored.data?.includes('COPY')) throw new Error('Incomplete logical backup.')
    globalThis.console.log(JSON.stringify({ verified: true, createdAt: restored.createdAt, target: restored.target, schemaBytes: Buffer.byteLength(restored.schema), dataBytes: Buffer.byteLength(restored.data), storageFilesIncluded: false }))
    return
  }
  const dump = extra => execFileSync('npx', ['supabase', 'db', 'dump', local ? '--local' : '--linked', '--schema', 'public,private,auth,storage', ...extra], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  const payload = { createdAt: new Date().toISOString(), target: local ? 'local-fictional-qa' : (await readFile('supabase/.temp/project-ref', 'utf8')).trim(), schema: dump([]), data: dump(['--data-only', '--use-copy']), storageFilesIncluded: false }
  const encrypted = encryptBackup(payload, key)
  if (decryptBackup(encrypted, key).data !== payload.data) throw new Error('Backup round trip failed.')
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, encrypted, { flag: 'wx', mode: 0o600 })
  globalThis.console.log(JSON.stringify({ created: path, bytes: encrypted.length, sha256: createHash('sha256').update(encrypted).digest('hex'), target: payload.target, storageFilesIncluded: false }))
}
if (globalThis.process.argv[1] && import.meta.url === pathToFileURL(resolve(globalThis.process.argv[1])).href) main().catch(() => { globalThis.console.error('Backup failed. No successful backup is being reported. Check CLI authentication, connectivity, key and destination without sharing credentials.'); globalThis.process.exitCode = 1 })
