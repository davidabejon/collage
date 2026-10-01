import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
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
// Nav buttons sit at left-3/right-3 with size-11 (12px + 44px), plus some slack.
const NAV_STRIP = 64
const MAX_ZOOM = 4
const CLICK_ZOOM = 2.5
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_DISTANCE = 30

type View = { scale: number; x: number; y: number }
type Point = { x: number; y: number }
type Gesture =
  | { type: 'swipe'; start: Point; dragging: boolean }
  | { type: 'pan'; start: Point; view: View }
  | { type: 'pinch'; distance: number; mid: Point; view: View }

const IDENTITY: View = { scale: 1, x: 0, y: 0 }
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Stage rect plus the size of the photo as painted by object-contain at scale 1. */
function geometry(stage: HTMLElement, img: HTMLImageElement | null) {
  const rect = stage.getBoundingClientRect()
  const natural = { w: img?.naturalWidth ?? 0, h: img?.naturalHeight ?? 0 }
  const fit = natural.w && natural.h ? Math.min(rect.width / natural.w, rect.height / natural.h) : 0
  return { rect, width: natural.w * fit, height: natural.h * fit }
}

// Points are relative to the stage centre, which is also the transform origin.
const toLocal = (rect: DOMRect, clientX: number, clientY: number): Point => ({
  x: clientX - rect.left - rect.width / 2,
  y: clientY - rect.top - rect.height / 2,
})

const isOnPhoto = (point: Point, geo: ReturnType<typeof geometry>) =>
  geo.width > 0 && Math.abs(point.x) <= geo.width / 2 && Math.abs(point.y) <= geo.height / 2

function zoomAt(view: View, point: Point, scale: number): View {
  const next = clamp(scale, 1, MAX_ZOOM)
  return {
    scale: next,
    x: point.x - (next * (point.x - view.x)) / view.scale,
    y: point.y - (next * (point.y - view.y)) / view.scale,
  }
}

function clampView(view: View, geo: ReturnType<typeof geometry>): View {
  const scale = clamp(view.scale, 1, MAX_ZOOM)
  const maxX = Math.max(0, (geo.width * scale - geo.rect.width) / 2)
  const maxY = Math.max(0, (geo.height * scale - geo.rect.height) / 2)
  return { scale, x: clamp(view.x, -maxX, maxX), y: clamp(view.y, -maxY, maxY) }
}

export function PhotoViewer({ photos, index, onIndexChange, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLImageElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture | null>(null)
  const moved = useRef(false)
  const pointerType = useRef('mouse')
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null)
  const singleTapTimer = useRef<number | undefined>(undefined)
  const [chromeHidden, setChromeHidden] = useState(false)
  const [direction, setDirection] = useState<-1 | 0 | 1>(0)
  const [dragX, setDragX] = useState(0)
  const [overPhoto, setOverPhoto] = useState(false)
  const [zoom, setZoom] = useState({ ...IDENTITY, id: -1, smooth: false })
  const item = index !== null ? photos[index] : undefined
  const itemId = item?.id
  // Drop the zoom as soon as another photo (or none) is shown so returning starts fresh.
  if (zoom.id !== -1 && zoom.id !== itemId) setZoom({ ...IDENTITY, id: -1, smooth: false })
  const view: View = zoom.id === itemId ? zoom : IDENTITY
  const zoomed = view.scale > 1

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (item && !dialog.open) {
      setDirection(0)
      setChromeHidden(false)
      dialog.showModal()
    }
    if (!item && dialog.open) dialog.close()
  }, [item])

  useEffect(() => () => window.clearTimeout(singleTapTimer.current), [])

  useEffect(() => {
    if (index === null) return
    for (const neighbour of [photos[index - 1], photos[index + 1]]) {
      if (neighbour) new Image().src = mediaUrl(neighbour, 'full')
    }
  }, [index, photos])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || itemId === undefined) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const geo = geometry(stage, thumbRef.current)
      const point = toLocal(geo.rect, event.clientX, event.clientY)
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      setZoom((prev) => {
        const base = prev.id === itemId ? prev : IDENTITY
        return { ...clampView(zoomAt(base, point, base.scale * Math.exp(-delta * 0.002)), geo), id: itemId, smooth: false }
      })
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [itemId])

  const updateView = (next: View, smooth = false) => {
    const stage = stageRef.current
    if (!stage || itemId === undefined) return
    setZoom({ ...clampView(next, geometry(stage, thumbRef.current)), id: itemId, smooth })
  }

  const hasPrev = index !== null && index > 0
  const hasNext = index !== null && index < photos.length - 1
  const go = (delta: -1 | 1) => {
    if (index === null) return
    if ((delta === -1 && hasPrev) || (delta === 1 && hasNext)) {
      setDirection(delta)
      onIndexChange(index + delta)
    }
  }

  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  })
  const isOpen = item !== undefined
  // On the document: a nav button turning disabled drops focus to <body>, outside the dialog.
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') goRef.current(-1)
      if (event.key === 'ArrowRight') goRef.current(1)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  const localPoint = (clientX: number, clientY: number) =>
    toLocal(stageRef.current!.getBoundingClientRect(), clientX, clientY)

  const pinchState = (view: View): Gesture => {
    const [a, b] = [...pointers.current.values()]
    return {
      type: 'pinch',
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      mid: localPoint((a.x + b.x) / 2, (a.y + b.y) / 2),
      view,
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('button')) return
    // A primary pointer means no other touch is down; drop any pointer whose end event was lost.
    if (event.isPrimary) pointers.current.clear()
    pointerType.current = event.pointerType
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)
    const start = { x: event.clientX, y: event.clientY }
    if (pointers.current.size === 1) {
      moved.current = false
      gesture.current = zoomed ? { type: 'pan', start, view } : { type: 'swipe', start, dragging: false }
    } else if (pointers.current.size === 2) {
      moved.current = true
      setDragX(0)
      gesture.current = pinchState(view)
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && !pointers.current.size) {
      const geo = geometry(event.currentTarget, thumbRef.current)
      const over = isOnPhoto(toLocal(geo.rect, event.clientX, event.clientY), geo)
      if (over !== overPhoto) setOverPhoto(over)
    }
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const g = gesture.current
    if (g?.type === 'pinch' && pointers.current.size >= 2) {
      const now = pinchState(g.view) as Extract<Gesture, { type: 'pinch' }>
      const zoomedView = zoomAt(g.view, g.mid, (g.view.scale * now.distance) / g.distance)
      updateView({ ...zoomedView, x: zoomedView.x + now.mid.x - g.mid.x, y: zoomedView.y + now.mid.y - g.mid.y })
    } else if (g?.type === 'pan') {
      const dx = event.clientX - g.start.x
      const dy = event.clientY - g.start.y
      if (Math.hypot(dx, dy) > 4) moved.current = true
      updateView({ scale: g.view.scale, x: g.view.x + dx, y: g.view.y + dy })
    } else if (g?.type === 'swipe') {
      const dx = event.clientX - g.start.x
      if (!g.dragging) {
        if (Math.hypot(dx, event.clientY - g.start.y) >= 10) moved.current = true
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(event.clientY - g.start.y)) return
        g.dragging = true
        moved.current = true
      }
      // Resist past the first/last photo.
      setDragX((dx > 0 && !hasPrev) || (dx < 0 && !hasNext) ? dx / 4 : dx)
    }
  }

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return
    const g = gesture.current
    if (g?.type === 'swipe') {
      setDragX(0)
      const dx = event.clientX - g.start.x
      if (event.type === 'pointerup' && g.dragging && Math.abs(dx) > SWIPE_THRESHOLD) go(dx < 0 ? 1 : -1)
      gesture.current = null
    } else if (g?.type === 'pinch') {
      const [rest] = [...pointers.current.values()]
      if (rest && pointers.current.size === 1) gesture.current = { type: 'pan', start: rest, view }
      else if (pointers.current.size === 0) gesture.current = null
      if (pointers.current.size === 0 && view.scale < 1.05) updateView(IDENTITY, true)
    } else if (pointers.current.size === 0) {
      gesture.current = null
    }
    // Mobile browsers may skip the click after a swipe re-renders the photo, so taps are detected here.
    if (event.type === 'pointerup' && event.pointerType !== 'mouse' && !moved.current && pointers.current.size === 0) {
      onTouchTap(event.clientX, event.clientY, event.timeStamp)
    }
  }

  const onTouchTap = (clientX: number, clientY: number, time: number) => {
    const previous = lastTap.current
    const isDouble =
      previous && time - previous.time < DOUBLE_TAP_MS && Math.hypot(clientX - previous.x, clientY - previous.y) < DOUBLE_TAP_DISTANCE
    lastTap.current = isDouble ? null : { time, x: clientX, y: clientY }
    window.clearTimeout(singleTapTimer.current)
    if (!isDouble) {
      // Wait out the double-tap window so a zoom gesture doesn't also flash the UI.
      singleTapTimer.current = window.setTimeout(() => setChromeHidden((hidden) => !hidden), DOUBLE_TAP_MS)
      return
    }
    const geo = geometry(stageRef.current!, thumbRef.current)
    const point = toLocal(geo.rect, clientX, clientY)
    if (zoomed) {
      updateView(IDENTITY, true)
      setChromeHidden(false)
    } else if (isOnPhoto(point, geo)) {
      updateView(zoomAt(IDENTITY, point, CLICK_ZOOM), true)
      setChromeHidden(true)
    }
  }

  const onStageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (pointerType.current !== 'mouse' || moved.current || (event.target as Element).closest('button')) return
    const geo = geometry(event.currentTarget, thumbRef.current)
    const point = toLocal(geo.rect, event.clientX, event.clientY)

    if (zoomed) return updateView(IDENTITY, true)
    if (isOnPhoto(point, geo)) return updateView(zoomAt(IDENTITY, point, CLICK_ZOOM), true)
    if (!window.matchMedia('(min-width: 640px)').matches || !geo.width) return
    if (event.clientX < geo.rect.left + NAV_STRIP || event.clientX > geo.rect.right - NAV_STRIP) return
    onClose()
  }

  const navButton = 'absolute top-1/2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60! disabled:invisible max-sm:hidden'
  // Collapsing the grid row (not just fading) lets the stage reclaim the bars' space.
  const chrome = `grid transition-[grid-template-rows,opacity] duration-300 ease-out ${chromeHidden ? 'pointer-events-none grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`

  return (
    <dialog
      ref={ref}
      aria-label={item?.caption || 'Foto'}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      {item && index !== null && (
        <div className="flex size-full flex-col">
          <div inert={chromeHidden} className={chrome}>
            <div className="min-h-0 overflow-hidden">
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
            </div>
          </div>

          <div
            ref={stageRef}
            className={`relative min-h-0 grow touch-none overflow-hidden select-none ${zoomed ? 'cursor-grab active:cursor-grabbing' : overPhoto ? 'cursor-zoom-in' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onClick={onStageClick}
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
                <div
                  className={`absolute inset-0 ${zoom.smooth ? 'transition-transform duration-200 ease-out' : ''}`}
                  style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
                >
                  <img ref={thumbRef} src={mediaUrl(item)} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 size-full object-contain" />
                  <img
                    src={mediaUrl(item, 'full')}
                    alt={item.caption || 'Foto'}
                    draggable={false}
                    className="absolute inset-0 size-full object-contain"
                  />
                </div>
              </div>
            </div>
            <IconButton label="Foto anterior" onClick={() => go(-1)} disabled={!hasPrev} className={`${navButton} left-3`}>
              <IconChevronLeft />
            </IconButton>
            <IconButton label="Foto siguiente" onClick={() => go(1)} disabled={!hasNext} className={`${navButton} right-3`}>
              <IconChevronRight />
            </IconButton>
          </div>

          <div className={chrome}>
            <div className="min-h-0 overflow-hidden">
              <p
                key={item.id}
                className="flex min-h-14 animate-[fade-in_.32s_ease-out] items-center justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-center font-hand text-2xl sm:text-3xl"
              >
                {item.caption}
              </p>
            </div>
          </div>
        </div>
      )}
    </dialog>
  )
}
