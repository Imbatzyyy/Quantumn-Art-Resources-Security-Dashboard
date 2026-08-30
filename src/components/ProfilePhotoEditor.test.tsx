import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProfilePhotoEditor from './ProfilePhotoEditor.js'

class LoadedImage {
  naturalWidth = 1200
  naturalHeight = 800
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

describe('ProfilePhotoEditor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders an adjusted 512px WebP crop before the authenticated upload', async () => {
    const drawingContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
    }
    vi.stubGlobal('Image', LoadedImage)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(drawingContext as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      callback(new Blob(['secure-cropped-photo'], { type: type || 'image/webp' }))
    })

    const onSave = vi.fn(async (_photo: Blob) => undefined)
    render(<ProfilePhotoEditor sourceUrl="blob:local-profile-source" saving={false} onCancel={vi.fn()} onSave={onSave} />)

    const save = screen.getByRole('button', { name: 'Save profile picture' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Photo zoom'), { target: { value: '1.5' } })
    fireEvent.change(screen.getByLabelText('Horizontal photo position'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('Vertical photo position'), { target: { value: '-15' } })
    fireEvent.submit(save.closest('form')!)

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    const crop = onSave.mock.calls[0]?.[0]
    expect(crop).toBeInstanceOf(Blob)
    expect(crop?.type).toBe('image/webp')
    expect(drawingContext.drawImage).toHaveBeenCalled()
    expect(screen.getByText('150%')).toBeVisible()
  })
})
