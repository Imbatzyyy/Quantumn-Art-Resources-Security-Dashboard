import type { EmployeeRecord } from '../types/hrms.js'
import { requireSupabase } from './supabaseClient.js'

let viewer: string | undefined
const cache = new Map<string, { url: string; version?: string; expires: number }>()

/** Batch private URLs, scoped to the viewer and refreshed when the profile changes. */
export async function withEmployeeAvatarUrls(employees: EmployeeRecord[], viewerId: string): Promise<EmployeeRecord[]> {
  if (viewer !== viewerId) { cache.clear(); viewer = viewerId }
  const people = employees.filter((person) => person.role === 'employee' && person.avatarPath)
  const visiblePaths = new Set(people.map((person) => person.avatarPath!))
  for (const path of cache.keys()) if (!visiblePaths.has(path)) cache.delete(path)
  const now = Date.now()
  const missing = people.filter((person) => {
    const cached = cache.get(person.avatarPath!)
    if (cached && cached.version === person.avatarVersion && cached.expires > now) return false
    cache.delete(person.avatarPath!)
    return true
  })
  if (missing.length) {
    try {
      const paths = [...new Set(missing.map((person) => person.avatarPath!))]
      const { data, error } = await requireSupabase().storage.from('profile-avatars').createSignedUrls(paths, 3600)
      if (viewer !== viewerId) return employees
      if (!error) for (const item of data ?? []) {
        if (item.error || !item.path || !item.signedUrl) continue
        const person = missing.find((candidate) => candidate.avatarPath === item.path)
        cache.set(item.path, { url: `${item.signedUrl}${item.signedUrl.includes('?') ? '&' : '?'}v=${now}`, version: person?.avatarVersion, expires: now + 50 * 60 * 1000 })
      }
    } catch {
      // Missing or inaccessible photos must not prevent the HR record from loading.
    }
  }
  if (viewer !== viewerId) return employees
  return employees.map((person) => ({ ...person, avatarUrl: person.role === 'employee' ? cache.get(person.avatarPath ?? '')?.url : person.avatarUrl }))
}
