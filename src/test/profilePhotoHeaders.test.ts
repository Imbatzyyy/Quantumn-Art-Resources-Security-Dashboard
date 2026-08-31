import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('private avatar content security policy', () => {
  it('allows signed photos only from the connected Storage bucket in both hosting configurations', () => {
    const policies = ['public/_headers', 'netlify.toml'].map((file) => readFileSync(file, 'utf8').match(/img-src ([^;]+);/)?.[1])
    expect(policies[0]).toBe(policies[1])
    expect(policies[0]).toBe("'self' data: blob: https://ndzgmrmpsqqpcmoxvyfu.supabase.co/storage/v1/object/sign/profile-avatars/")
  })
})
