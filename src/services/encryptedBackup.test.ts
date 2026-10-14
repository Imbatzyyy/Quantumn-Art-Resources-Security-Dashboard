import { describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { encryptBackup, decryptBackup } from '../../scripts/encrypted-backup.mjs'
describe('encrypted backup format', () => {
  it('round-trips without exposing plaintext and rejects tampering and wrong keys', () => {
    const key = randomBytes(32), payload = { schema: 'CREATE fictional;', data: 'COPY private-fictional-record;' }
    const bytes = encryptBackup(payload, key)
    expect(bytes.toString()).not.toContain(payload.data)
    expect(decryptBackup(bytes, key)).toEqual(payload)
    expect(() => decryptBackup(bytes, randomBytes(32))).toThrow()
    const corrupted = Buffer.from(bytes); corrupted[corrupted.length - 1] ^= 1
    expect(() => decryptBackup(corrupted, key)).toThrow()
    expect(() => encryptBackup(payload, Buffer.alloc(1))).toThrow()
  })
})
