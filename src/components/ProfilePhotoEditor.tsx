import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { CheckCircle2, Crop, Image as ImageIcon, Move, RotateCcw, ShieldCheck, ZoomIn } from 'lucide-react'
import { clampPhotoPosition, getPhotoCrop, PROFILE_PHOTO_SIZE as OUTPUT_SIZE, profilePhotoExtension } from '../utils/profilePhotoCrop.js'

interface ProfilePhotoEditorProps {
  sourceUrl: string
  saving: boolean
  onCancel: () => void
  onSave: (photo: Blob) => Promise<void>
}

function paintCrop(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  zoom: number,
  horizontal: number,
  vertical: number,
) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The image preview could not be prepared. Please try another browser.')
  const { x, y, width, height } = getPhotoCrop(image.naturalWidth, image.naturalHeight, zoom, horizontal, vertical)
  context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, x, y, width, height)
}

export default function ProfilePhotoEditor({ sourceUrl, saving, onCancel, onSave }: ProfilePhotoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [horizontal, setHorizontal] = useState(0)
  const [vertical, setVertical] = useState(0)
  const [error, setError] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const exporting = useRef(false)
  const mounted = useRef(true)
  const drag = useRef<{ id: number; x: number; y: number; horizontal: number; vertical: number } | null>(null)
  const busy = saving || preparing

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    const nextImage = new Image()
    nextImage.onload = () => setImage(nextImage)
    nextImage.onerror = () => setError('This image could not be opened. Choose another JPG, PNG, or WebP file.')
    nextImage.src = sourceUrl
    return () => { nextImage.onload = null; nextImage.onerror = null }
  }, [sourceUrl])

  useEffect(() => {
    if (image && canvasRef.current) {
      try { paintCrop(canvasRef.current, image, zoom, horizontal, vertical) }
      catch { /* Submission reports a canvas failure without interrupting the editor. */ }
    }
  }, [horizontal, image, vertical, zoom])

  const reset = () => {
    setZoom(1)
    setHorizontal(0)
    setVertical(0)
  }

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!image || busy || event.button !== 0 || drag.current) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal, vertical }
    setDragging(true)
  }

  const movePhoto = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start || start.id !== event.pointerId || !image || busy) return
    const crop = getPhotoCrop(image.naturalWidth, image.naturalHeight, zoom, start.horizontal, start.vertical)
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const dx = (event.clientX - start.x) * OUTPUT_SIZE / bounds.width
    const dy = (event.clientY - start.y) * OUTPUT_SIZE / bounds.height
    setHorizontal(crop.availableX ? Math.round(clampPhotoPosition(start.horizontal + dx / crop.availableX * 100)) : 0)
    setVertical(crop.availableY ? Math.round(clampPhotoPosition(start.vertical + dy / crop.availableY * 100)) : 0)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const keyboardPosition = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!image || busy) return
    const step = event.shiftKey ? 20 : 5
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'ArrowLeft') setHorizontal((value) => clampPhotoPosition(value - step))
    if (event.key === 'ArrowRight') setHorizontal((value) => clampPhotoPosition(value + step))
    if (event.key === 'ArrowUp') setVertical((value) => clampPhotoPosition(value - step))
    if (event.key === 'ArrowDown') setVertical((value) => clampPhotoPosition(value + step))
    if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(3, Math.round((value + .05) * 100) / 100))
    if (event.key === '-') setZoom((value) => Math.max(1, Math.round((value - .05) * 100) / 100))
    if (event.key === 'Home') reset()
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || exporting.current) return
    setError('')
    const canvas = canvasRef.current
    if (!canvas || !image) return setError('Wait for the image preview to finish loading.')
    exporting.current = true
    setPreparing(true)
    try {
      // Paint the current selection synchronously so export cannot capture a stale effect.
      paintCrop(canvas, image, zoom, horizontal, vertical)
      const photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', .9))
      if (!mounted.current) return
      if (!photo || !photo.size) throw new Error('The cropped image could not be prepared. Choose another photo.')
      // Unsupported canvas encoders return PNG. Preserve the real MIME type and extension.
      profilePhotoExtension(photo.type)
      if (photo.size > 2 * 1024 * 1024) throw new Error('The cropped image is larger than 2 MB. Choose a smaller source photo.')
      await onSave(photo)
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : 'The profile photo could not be uploaded. Try again.')
    } finally {
      exporting.current = false
      if (mounted.current) setPreparing(false)
    }
  }

  return <form className="profile-photo-editor" onSubmit={submit} aria-busy={busy}>
    <section className="photo-editor-intro"><span><Crop /></span><div><small>Private photo editor</small><h3>Frame your profile picture</h3><p>Drag your photo to choose its position, then zoom to frame it. Only your final 512 × 512 crop is uploaded.</p></div><span className="photo-editor-format"><CheckCircle2 />512 × 512 crop</span></section>
    <div className="photo-editor-content">
      <section className="photo-editor-stage">
        <div className={`photo-crop-frame${dragging ? ' is-dragging' : ''}`} role="group" aria-label="Reposition profile photo" aria-describedby="photo-crop-instructions" tabIndex={busy ? -1 : 0} onPointerDown={startDrag} onPointerMove={movePhoto} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onKeyDown={keyboardPosition}><canvas ref={canvasRef} width={OUTPUT_SIZE} height={OUTPUT_SIZE} aria-label="Profile photo crop preview" /><div className="photo-crop-mask" aria-hidden="true" /></div>
        <div className="photo-preview-caption"><ImageIcon /><div><strong>Drag to reposition</strong><small id="photo-crop-instructions">Drag or use arrow keys to move. Zoom in for more room to position your photo. The circle matches your saved avatar.</small></div></div>
      </section>
      <section className="photo-editor-controls">
        <header><span><Move /></span><div><small>Crop controls</small><h4>Fine-tune the frame</h4></div><button type="button" onClick={reset} disabled={busy}><RotateCcw />Reset</button></header>
        <label><span><ZoomIn />Zoom <strong>{Math.round(zoom * 100)}%</strong></span><input aria-label="Photo zoom" type="range" min="1" max="3" step="0.05" disabled={busy} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
        <label><span><Move />Horizontal position <strong>{horizontal}</strong></span><input aria-label="Horizontal photo position" type="range" min="-100" max="100" step="1" disabled={busy} value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))} /></label>
        <label><span><Move />Vertical position <strong>{vertical}</strong></span><input aria-label="Vertical photo position" type="range" min="-100" max="100" step="1" disabled={busy} value={vertical} onChange={(event) => setVertical(Number(event.target.value))} /></label>
        <div className="photo-editor-assurance"><ShieldCheck /><div><strong>Protected upload</strong><p>The original file stays on this device. The browser creates a compressed crop before the authenticated upload.</p></div></div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </div>
    <footer className="photo-editor-footer"><div><ShieldCheck /><p><strong>Employee-owned storage.</strong> Supabase policies restrict this object path to your signed-in account.</p></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Choose another photo</button><button className="button button-primary" disabled={busy || !image}>{saving ? 'Uploading securely…' : preparing ? 'Preparing your crop…' : 'Save profile picture'}</button></div></footer>
  </form>
}
