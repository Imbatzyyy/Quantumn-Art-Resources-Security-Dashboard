export const PROFILE_PHOTO_SIZE = 512
export const clampPhotoPosition = (value: number) => Math.max(-100, Math.min(100, value))

export function profilePhotoExtension(type: string): 'webp' | 'png' {
  if (type === 'image/webp') return 'webp'
  if (type === 'image/png') return 'png'
  throw new Error('The cropped photo must be a WebP or PNG image. Please choose your photo again.')
}

export function getPhotoCrop(width: number, height: number, zoom: number, horizontal: number, vertical: number) {
  const scale = Math.max(PROFILE_PHOTO_SIZE / width, PROFILE_PHOTO_SIZE / height) * Math.max(1, Math.min(3, zoom))
  const scaledWidth = width * scale
  const scaledHeight = height * scale
  const availableX = Math.max(0, (scaledWidth - PROFILE_PHOTO_SIZE) / 2)
  const availableY = Math.max(0, (scaledHeight - PROFILE_PHOTO_SIZE) / 2)
  return {
    width: scaledWidth,
    height: scaledHeight,
    availableX,
    availableY,
    x: -availableX + (clampPhotoPosition(horizontal) / 100) * availableX,
    y: -availableY + (clampPhotoPosition(vertical) / 100) * availableY,
  }
}
