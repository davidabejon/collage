import { useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { mediaUrl } from '../../api/endpoints'
import type { Item } from '../../api/types'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'

type Framing = Pick<Item, 'focal_x' | 'focal_y' | 'photo_zoom'>

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function PhotoCropDialog({ item, aspect, saving, onClose, onSave }: {
  item: Item | null
  aspect: number
  saving: boolean
  onClose: () => void
  onSave: (framing: Framing) => void
}) {
  return (
    <Modal open={item !== null} onClose={onClose} title="Encuadrar foto" className="max-w-lg!">
      {item && <CropEditor key={item.id} item={item} aspect={aspect} saving={saving} onClose={onClose} onSave={onSave} />}
    </Modal>
  )
}

function CropEditor({ item, aspect, saving, onClose, onSave }: {
  item: Item
  aspect: number
  saving: boolean
  onClose: () => void
  onSave: (framing: Framing) => void
}) {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(item.photo_zoom)
  const [framing, setFraming] = useState<Framing>({
    focal_x: item.focal_x, focal_y: item.focal_y, photo_zoom: item.photo_zoom,
  })
  const source = mediaUrl(item, 'full')
  const imageAspect = imageSize ? imageSize.width / imageSize.height : 1
  const baseWidth = Math.min(1, aspect / imageAspect)
  const baseHeight = Math.min(1, imageAspect / aspect)
  const areaWidth = baseWidth * 100 / item.photo_zoom
  const areaHeight = baseHeight * 100 / item.photo_zoom
  const initialArea: Area = {
    width: areaWidth,
    height: areaHeight,
    x: clamp(item.focal_x * 100 - areaWidth / 2, 0, 100 - areaWidth),
    y: clamp(item.focal_y * 100 - areaHeight / 2, 0, 100 - areaHeight),
  }

  return (
    <div>
      <img
        src={source}
        alt=""
        className="hidden"
        onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        onError={() => setFailed(true)}
      />
      <div className="relative mx-auto aspect-square w-full max-w-90 overflow-hidden bg-neutral-800">
        {imageSize && !failed && (
          <Cropper
            image={source}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            minZoom={1}
            maxZoom={4}
            initialCroppedAreaPercentages={initialArea}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropAreaChange={(area) => setFraming({
              focal_x: clamp((area.x + area.width / 2) / 100, 0, 1),
              focal_y: clamp((area.y + area.height / 2) / 100, 0, 1),
              photo_zoom: clamp(baseWidth * 100 / area.width, 1, 4),
            })}
          />
        )}
        {!imageSize && <div className="grid size-full place-items-center text-sm text-white/80">{failed ? 'No se pudo cargar la foto' : 'Cargando foto…'}</div>}
      </div>
      <label className="mt-5 flex items-center gap-4 text-sm font-medium">
        Zoom
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          disabled={!imageSize || failed}
          className="min-w-0 flex-1 accent-accent"
        />
        <span className="w-12 text-right tabular-nums">{zoom.toFixed(1)}×</span>
      </label>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={!imageSize || failed || saving} onClick={() => onSave(framing)}>Guardar</Button>
      </div>
    </div>
  )
}