import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, Crop, Image as ImageIcon, Move, RotateCcw, ShieldCheck, ZoomIn } from 'lucide-react'

interface ProfilePhotoEditorProps {
  sourceUrl: string
  saving: boolean
  onCancel: () => void
  onSave: (photo: Blob) => Promise<void>
}

const OUTPUT_SIZE = 512

function paintCrop(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  zoom: number,
  horizontal: number,
  vertical: number,
) {
  const context = canvas.getContext('2d')
  if (!context) return
  const baseScale = Math.max(OUTPUT_SIZE / image.naturalWidth, OUTPUT_SIZE / image.naturalHeight)
  const scale = baseScale * zoom
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  const availableX = Math.max(0, (width - OUTPUT_SIZE) / 2)
  const availableY = Math.max(0, (height - OUTPUT_SIZE) / 2)
  const x = (OUTPUT_SIZE - width) / 2 + (horizontal / 100) * availableX
  const y = (OUTPUT_SIZE - height) / 2 + (vertical / 100) * availableY
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

  useEffect(() => {
    const nextImage = new Image()
    nextImage.onload = () => setImage(nextImage)
    nextImage.onerror = () => setError('This image could not be opened. Choose another JPG, PNG, or WebP file.')
    nextImage.src = sourceUrl
    return () => { nextImage.onload = null; nextImage.onerror = null }
  }, [sourceUrl])

  useEffect(() => {
    if (image && canvasRef.current) paintCrop(canvasRef.current, image, zoom, horizontal, vertical)
  }, [horizontal, image, vertical, zoom])

  const reset = () => {
    setZoom(1)
    setHorizontal(0)
    setVertical(0)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const canvas = canvasRef.current
    if (!canvas || !image) return setError('Wait for the image preview to finish loading.')
    const photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', .9))
    if (!photo) return setError('The cropped image could not be prepared. Choose another photo.')
    if (photo.size > 2 * 1024 * 1024) return setError('The cropped image is larger than 2 MB. Choose a smaller source photo.')
    try {
      await onSave(photo)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The profile photo could not be uploaded. Try again.')
    }
  }

  return <form className="profile-photo-editor" onSubmit={submit} aria-busy={saving}>
    <section className="photo-editor-intro"><span><Crop /></span><div><small>Private photo editor</small><h3>Frame your profile picture</h3><p>Position the photo inside the circle. Only the final 512 × 512 crop is sent to your private Supabase Storage folder.</p></div><span className="photo-editor-format"><CheckCircle2 />WebP output</span></section>
    <div className="photo-editor-content">
      <section className="photo-editor-stage">
        <div className="photo-crop-frame"><canvas ref={canvasRef} width={OUTPUT_SIZE} height={OUTPUT_SIZE} aria-label="Profile photo crop preview" /><div className="photo-crop-mask" aria-hidden="true" /><span className="crop-corner top-left" /><span className="crop-corner top-right" /><span className="crop-corner bottom-left" /><span className="crop-corner bottom-right" /></div>
        <div className="photo-preview-caption"><ImageIcon /><div><strong>Live circular preview</strong><small>The saved file remains square and displays as a circle throughout the portal.</small></div></div>
      </section>
      <section className="photo-editor-controls">
        <header><span><Move /></span><div><small>Crop controls</small><h4>Fine-tune the frame</h4></div><button type="button" onClick={reset}><RotateCcw />Reset</button></header>
        <label><span><ZoomIn />Zoom <strong>{Math.round(zoom * 100)}%</strong></span><input aria-label="Photo zoom" type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
        <label><span><Move />Horizontal position <strong>{horizontal}</strong></span><input aria-label="Horizontal photo position" type="range" min="-100" max="100" step="1" value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))} /></label>
        <label><span><Move />Vertical position <strong>{vertical}</strong></span><input aria-label="Vertical photo position" type="range" min="-100" max="100" step="1" value={vertical} onChange={(event) => setVertical(Number(event.target.value))} /></label>
        <div className="photo-editor-assurance"><ShieldCheck /><div><strong>Protected upload</strong><p>The original file stays on this device. The browser creates a compressed crop before the authenticated upload.</p></div></div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </div>
    <footer className="photo-editor-footer"><div><ShieldCheck /><p><strong>Employee-owned storage.</strong> Supabase policies restrict this object path to your signed-in account.</p></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onCancel} disabled={saving}>Choose another photo</button><button className="button button-primary" disabled={saving || !image}>{saving ? 'Uploading securely…' : 'Save profile picture'}</button></div></footer>
  </form>
}
