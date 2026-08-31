import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withEmployeeAvatarUrls } from './supabaseAvatars.js'
import type { EmployeeRecord } from '../types/hrms.js'

const signed = vi.hoisted(() => vi.fn())
vi.mock('./supabaseClient.js', () => ({ requireSupabase: () => ({ storage: { from: (bucket: string) => {
  expect(bucket).toBe('profile-avatars')
  return { createSignedUrls: signed }
} } }) }))
const employee: EmployeeRecord = { id: 'EMP1', firstName: 'Maya', lastName: 'Santos', email: 'maya@example.test', department: 'Design', position: 'Designer', status: 'Active', role: 'employee', avatarPath: 'owner/avatar.png' }

describe('private directory photos', () => {
  let viewer = 0
  beforeEach(() => { signed.mockReset(); viewer += 1 })
  it('signs employee paths in one batch and does not sign administrator photos', async () => {
    signed.mockResolvedValue({ data: [{ path: employee.avatarPath, signedUrl: 'https://storage.example.test/photo?token=test', error: null }], error: null })
    const result = await withEmployeeAvatarUrls([employee, { ...employee, id: 'ADM1', role: 'admin', avatarPath: 'admin/avatar.png' }], String(viewer))
    expect(signed).toHaveBeenCalledExactlyOnceWith(['owner/avatar.png'], 3600)
    expect(result[0].avatarUrl).toMatch(/^https:\/\/storage.example.test\/photo\?token=test&v=\d+$/)
    expect(result[1].avatarUrl).toBeUndefined()
    await withEmployeeAvatarUrls([employee], String(viewer))
    expect(signed).toHaveBeenCalledTimes(1)
    await withEmployeeAvatarUrls([{ ...employee, avatarVersion: 'changed' }], String(viewer))
    expect(signed).toHaveBeenCalledTimes(2)
  })
  it('keeps readable records when photos are denied or missing', async () => {
    signed.mockResolvedValue({ data: [{ path: employee.avatarPath, signedUrl: '', error: 'Not found' }], error: null })
    expect((await withEmployeeAvatarUrls([employee], String(viewer)))[0].avatarUrl).toBeUndefined()
    signed.mockRejectedValue(new Error('Offline'))
    expect(await withEmployeeAvatarUrls([employee], String(viewer))).toEqual([employee])
    signed.mockResolvedValue({ data: null, error: new Error('Forbidden') })
    expect(await withEmployeeAvatarUrls([employee], String(viewer))).toEqual([employee])
  })
  it('makes no storage request when no employee has a photo', async () => {
    await withEmployeeAvatarUrls([{ ...employee, avatarPath: undefined }], String(viewer))
    expect(signed).not.toHaveBeenCalled()
  })
})
