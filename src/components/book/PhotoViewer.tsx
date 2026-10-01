import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { mediaUrl } from '../../api/endpoints'
import type { Item } from '../../api/types'
import { downloadPhoto } from '../../lib/download'
import { IconButton } from '../../ui/Button'
import { IconChevronLeft, IconChevronRight, IconClose, IconDownload } from '../../ui/icons'

type Props = {
  photos: Item[]
  index: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
}

const SWIPE_THRESHOLD = 50

export function PhotoViewer({ photos, index, onIndexChange, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const swipeStart = useRef<{ x: number; y: number; dragging: boolean } | null>(null)
  const [direction, setDirection] = useState<-1 | 0 | 1>(0)
  const [dragX, setDragX] = useState(0)
  const item = index !== null ? photos[index] : undefined

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (item && !dialog.open) {
      setDirection(0)
      dialog.showModal()
    }
    if (!item && dialog.open) dialog.close()
  }, [item])

  useEffect(() => {
    if (index === null) return
    for (const neighbour of [photos[index - 1], photos[index + 1]]) {
      if (neighbour) new Image().src = mediaUrl(neighbour, 'full')
    }
  }, [index, photos])

  const hasPrev = index !== null && index > 0
  const hasNext = index !== null && index < photos.length - 1
  const go = (delta: -1 | 1) => {
    if (index === null) return
    if ((delta === -1 && hasPrev) || (delta === 1 && hasNext)) {
      setDirection(delta)
      onIndexChange(index + delta)
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    if (!start) return
    const dx = event.clientX - start.x
    if (!start.dragging) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(event.clientY - start.y)) return
      start.dragging = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    // Resist past the first/last photo.
    setDragX((dx > 0 && !hasPrev) || (dx < 0 && !hasNext) ? dx / 4 : dx)
  }

  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current
    swipeStart.current = null
    setDragX(0)
    if (!start?.dragging) return
    const dx = event.clientX - start.x
    if (Math.abs(dx) > SWIPE_THRESHOLD) go(dx < 0 ? 1 : -1)
  }

  const navButton = 'absolute top-1/2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60! disabled:invisible max-sm:hidden'

  return (
    <dialog
      ref={ref}
      aria-label={item?.caption || 'Foto'}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') go(-1)
        if (event.key === 'ArrowRight') go(1)
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      {item && index !== null && (
        <div className="flex size-full flex-col">
          <div className="flex items-center gap-1 px-2 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <IconButton label="Cerrar" onClick={onClose} className="hover:bg-white/10!">
              <IconClose />
            </IconButton>
            <span className="grow text-sm tabular-nums text-white/75">
              {index + 1} / {photos.length}
            </span>
            <IconButton label="Descargar" onClick={() => downloadPhoto(item)} className="hover:bg-white/10!">
              <IconDownload />
            </IconButton>
          </div>

          <div
            className="relative min-h-0 grow touch-pan-y overflow-hidden select-none"
            onPointerDown={(event) => {
              swipeStart.current = { x: event.clientX, y: event.clientY, dragging: false }
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              swipeStart.current = null
              setDragX(0)
            }}
          >
            <div
              key={item.id}
              className={`absolute inset-0 ${dragX ? '' : 'transition-transform duration-200 ease-out'}`}
              style={{ transform: `translateX(${dragX}px)` }}
            >
              <div
                className="absolute inset-0 animate-[slide-in_.32s_cubic-bezier(.2,.8,.2,1)]"
                style={{ '--slide-from': `${direction * 30}%` } as CSSProperties}
              >
                <img src={mediaUrl(item)} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 size-full object-contain" />
                <img
                  src={mediaUrl(item, 'full')}
                  alt={item.caption || 'Foto'}
                  draggable={false}
                  className="absolute inset-0 size-full object-contain"
                />
              </div>
            </div>
            <IconButton label="Foto anterior" onClick={() => go(-1)} disabled={!hasPrev} className={`${navButton} left-3`}>
              <IconChevronLeft />
            </IconButton>
            <IconButton label="Foto siguiente" onClick={() => go(1)} disabled={!hasNext} className={`${navButton} right-3`}>
              <IconChevronRight />
            </IconButton>
          </div>

          <p
            key={item.id}
            className="flex min-h-14 animate-[fade-in_.32s_ease-out] items-center justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-center font-hand text-2xl sm:text-3xl"
          >
            {item.caption}
          </p>
        </div>
      )}
    </dialog>
  )
}
