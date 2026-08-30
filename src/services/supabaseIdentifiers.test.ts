import { describe, expect, it } from 'vitest'
import { databaseId } from './supabaseIdentifiers.js'

describe('Supabase numeric identifier boundary', () => {
  it('accepts a positive database identity represented by the UI as a string', () => {
    expect(databaseId('42', 'Employee request')).toBe(42)
  })

  it('accepts an already numeric positive database identity', () => {
    expect(databaseId(7, 'Document')).toBe(7)
  })

  it.each(['REQ-42', '1.5', '0', '-3', ''])('rejects an invalid identifier value: %s', (value) => {
    expect(() => databaseId(value, 'Employee request')).toThrow('Employee request is not a valid database identifier.')
  })

  it('rejects unsafe integer values before they reach an RPC', () => {
    expect(() => databaseId(Number.MAX_SAFE_INTEGER + 1, 'Notification')).toThrow(
      'Notification is not a valid database identifier.',
    )
  })
})
