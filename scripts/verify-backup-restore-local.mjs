import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { decryptBackup } from './encrypted-backup.mjs'
import { loadLocalQaRuntime } from './local-qa-runtime.mjs'

await loadLocalQaRuntime() // fails closed for a remote target
const key = Buffer.from(globalThis.process.env.HRMS_BACKUP_KEY || '', 'base64')
const backup = decryptBackup(await readFile(globalThis.process.argv[2]), key)
if (backup.target !== 'local-fictional-qa') throw new Error('Restore drill accepts only fictional local backups, never production personnel data.')
const database = `qa_restore_${randomUUID().replaceAll('-', '')}`
const container = 'supabase_db_quantum-hrms-local-qa'
const exec = args => execFileSync('docker', ['exec', container, ...args], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] })
const sql = query => execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'supabase_admin', '-d', database, '-v', 'ON_ERROR_STOP=1', '-At'], { input: query, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['pipe','pipe','pipe'] })
exec(['createdb','-U','supabase_admin',database])
try {
  sql(backup.schema)
  sql(`BEGIN; SET session_replication_role=replica;\n${backup.data}\nCOMMIT;`)
  const counts = JSON.parse(sql("select json_build_object('profiles',(select count(*) from public.profiles),'users',(select count(*) from auth.users),'rlsTables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity));"))
  if (counts.profiles < 2 || counts.users < 2 || counts.rlsTables < 25) throw new Error('Restore validation failed.')
  globalThis.console.log(JSON.stringify({ restored: true, ...counts, storageBytesTested: false }))
} finally {
  // Exact database allocated by this invocation; no shared databases touched.
  exec(['dropdb','-U','supabase_admin',database])
}
