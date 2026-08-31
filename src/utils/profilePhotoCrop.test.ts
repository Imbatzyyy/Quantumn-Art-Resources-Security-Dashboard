import { describe, expect, it } from 'vitest'
import { getPhotoCrop, profilePhotoExtension } from './profilePhotoCrop.js'

describe('profile photo crop geometry', () => {
  it.each([[1200, 800], [800, 1200], [800, 800]])('keeps a %sx%s photo covering the exported square at every edge', (width, height) => {
    for (const zoom of [1, 1.5, 3]) {
      for (const position of [-200, -100, 0, 100, 200]) {
        const crop = getPhotoCrop(width, height, zoom, position, position)
        expect(crop.x).toBeLessThanOrEqual(0)
        expect(crop.y).toBeLessThanOrEqual(0)
        expect(crop.x + crop.width).toBeGreaterThanOrEqual(512)
        expect(crop.y + crop.height).toBeGreaterThanOrEqual(512)
      }
    }
  })

  it('preserves the true encoder format instead of renaming PNG bytes to WebP', () => {
    expect(profilePhotoExtension('image/webp')).toBe('webp')
    expect(profilePhotoExtension('image/png')).toBe('png')
    expect(() => profilePhotoExtension('image/svg+xml')).toThrow()
  })
})
