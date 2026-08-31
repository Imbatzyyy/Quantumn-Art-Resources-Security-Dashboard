import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  beforeEach(() => {
    vi.stubGlobal('Image', LoadedImage)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(), drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
  })
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

  it('accepts the PNG crop returned by browsers without a WebP encoder', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png-crop'], { type: 'image/png' })))
    const onSave = vi.fn(async (_photo: Blob) => undefined)
    render(<ProfilePhotoEditor sourceUrl="blob:photo" saving={false} onCancel={vi.fn()} onSave={onSave} />)
    const save = screen.getByRole('button', { name: 'Save profile picture' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.submit(save.closest('form')!)
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave.mock.calls[0][0].type).toBe('image/png')
  })

  it('moves with mouse or touch pointers, clamps the crop, and supports keyboard positioning', async () => {
    render(<ProfilePhotoEditor sourceUrl="blob:photo" saving={false} onCancel={vi.fn()} onSave={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save profile picture' })).toBeEnabled())
    const frame = screen.getByRole('group', { name: 'Reposition profile photo' })
    Object.assign(frame, { setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() })
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({ width: 512, height: 512 } as DOMRect)
    fireEvent.change(screen.getByLabelText('Photo zoom'), { target: { value: '2' } })
    fireEvent.pointerDown(frame, { pointerId: 1, button: 0, clientX: 100, clientY: 100, pointerType: 'touch' })
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 228, clientY: 228, pointerType: 'touch' })
    expect(screen.getByLabelText('Horizontal photo position')).toHaveValue('25')
    expect(screen.getByLabelText('Vertical photo position')).toHaveValue('50')
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 9999, clientY: -9999 })
    expect(screen.getByLabelText('Horizontal photo position')).toHaveValue('100')
    expect(screen.getByLabelText('Vertical photo position')).toHaveValue('-100')
    fireEvent.pointerUp(frame, { pointerId: 1 })
    fireEvent.keyDown(frame, { key: 'Home' })
    expect(screen.getByLabelText('Photo zoom')).toHaveValue('1')
    fireEvent.keyDown(frame, { key: 'ArrowLeft' })
    expect(screen.getByLabelText('Horizontal photo position')).toHaveValue('-5')
  })

  it('reports encoder failure and never uploads an invalid crop', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(() => { throw new Error('Image export unavailable') })
    const onSave = vi.fn()
    render(<ProfilePhotoEditor sourceUrl="blob:photo" saving={false} onCancel={vi.fn()} onSave={onSave} />)
    const save = screen.getByRole('button', { name: 'Save profile picture' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.submit(save.closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('Image export unavailable')
    expect(onSave).not.toHaveBeenCalled()
    expect(save).toBeEnabled()
  })
})
