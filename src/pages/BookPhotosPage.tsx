import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { mediaUrl } from '../api/endpoints'
import { useBook } from '../api/queries'
import type { Item } from '../api/types'
import { PhotoViewer } from '../components/book/PhotoViewer'
import { useBookItems } from '../components/book/useBookItems'
import { downloadPhotos } from '../lib/download'
import { Button, IconButton, Spinner } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { IconBack, IconCheck, IconClose, IconDownload, IconTrash } from '../ui/icons'

const LONG_PRESS_MS = 450

export function BookPhotosPage() {
  const bookId = Number(useParams().id)
  const book = useBook(bookId)
  const actions = useBookItems(bookId)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const longPress = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null)

  const photos = book.data?.items.filter((i) => i.type === 'photo') ?? []
  const viewingId = Number(searchParams.get('foto'))
  const viewIndex = photos.findIndex((p) => p.id === viewingId)

  const stopSelecting = () => {
    setSelecting(false)
    setSelected(new Set())
  }

  useEffect(() => {
    if (!selecting) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        setSelecting(false)
        setSelected(new Set())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selecting])

  const toggle = (id: number) => {
    setSelecting(true)
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  const openViewer = (item: Item) => setSearchParams({ foto: String(item.id) }, { state: { viewer: true } })
  const showIndex = (index: number) =>
    setSearchParams({ foto: String(photos[index].id) }, { replace: true, state: location.state })
  const closeViewer = () => {
    if ((location.state as { viewer?: boolean } | null)?.viewer) navigate(-1)
    else setSearchParams({}, { replace: true })
  }

  const cancelLongPress = () => {
    if (longPress.current) clearTimeout(longPress.current.timer)
  }
  const onTilePointerDown = (event: PointerEvent, item: Item) => {
    cancelLongPress()
    longPress.current = null
    if (event.pointerType === 'mouse') return
    const press = { x: event.clientX, y: event.clientY, fired: false, timer: 0 }
    press.timer = window.setTimeout(() => {
      press.fired = true
      navigator.vibrate?.(10)
      toggle(item.id)
    }, LONG_PRESS_MS)
    longPress.current = press
  }
  const onTilePointerMove = (event: PointerEvent) => {
    const press = longPress.current
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) cancelLongPress()
  }
  const onTileClick = (item: Item) => {
    if (longPress.current?.fired) {
      longPress.current = null
      return
    }
    if (selecting) toggle(item.id)
    else openViewer(item)
  }

  if (book.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center text-ink-soft">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (book.isError) {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <p className="font-hand text-4xl">Este libro no está en tu estantería</p>
          <Link to="/" className="mt-4 inline-block text-accent underline underline-offset-4">
            Volver a la biblioteca
          </Link>
        </div>
      </div>
    )
  }

  const data = book.data
  const selectedPhotos = photos.filter((p) => selected.has(p.id))
  const allSelected = photos.length > 0 && selected.size === photos.length
  const selectionActions = [
    {
      label: allSelected ? 'Ninguna' : 'Todas',
      icon: <IconCheck />,
      onClick: () => setSelected(allSelected ? new Set() : new Set(photos.map((p) => p.id))),
    },
    { label: 'Descargar', icon: <IconDownload />, onClick: () => downloadPhotos(selectedPhotos), disabled: !selected.size },
    { label: 'Borrar', icon: <IconTrash />, onClick: () => setConfirmDelete(true), disabled: !selected.size },
  ]

  return (
    <div className={`min-h-dvh ${selecting ? 'pb-28 sm:pb-12' : 'pb-12'}`}>
      <header className="sticky top-0 z-30 border-b border-black/5 bg-desk/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-2 sm:px-6">
          {selecting ? (
            <>
              <IconButton label="Cancelar selección" onClick={stopSelecting}>
                <IconClose />
              </IconButton>
              <p className="min-w-0 grow truncate font-display text-lg font-semibold" aria-live="polite">
                {selected.size === 1 ? '1 seleccionada' : `${selected.size} seleccionadas`}
              </p>
              <div className="hidden items-center gap-2 sm:flex">
                {selectionActions.map((a) => (
                  <Button key={a.label} variant={a.label === 'Borrar' ? 'danger' : 'secondary'} onClick={a.onClick} disabled={a.disabled}>
                    {a.icon}
                    {a.label}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              <Link
                to={`/books/${bookId}`}
                aria-label="Volver al álbum"
                title="Volver al álbum"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full transition hover:bg-black/5"
              >
                <IconBack />
              </Link>
              <div className="flex min-w-0 grow items-center gap-3">
                <span aria-hidden="true" className="h-8 w-6 shrink-0 rounded-r-sm rounded-l-[2px] shadow-sm" style={{ backgroundColor: data.cover_color }} />
                <div className="min-w-0">
                  <h1 className="truncate font-display text-lg font-semibold leading-tight">{data.title}</h1>
                  <p className="text-xs text-ink-soft">{photos.length === 1 ? '1 foto' : `${photos.length} fotos`}</p>
                </div>
              </div>
              {photos.length > 0 && (
                <Button variant="secondary" onClick={() => setSelecting(true)} className="shrink-0 px-4">
                  Seleccionar
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-0.5 pt-0.5 sm:px-6 sm:pt-6">
        {photos.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-hand text-4xl">Todavía no hay fotos</p>
            <Link to={`/books/${bookId}`} className="mt-4 inline-block text-accent underline underline-offset-4">
              Volver al álbum
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-0.5 sm:grid-cols-4 sm:gap-1 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {photos.map((item) => {
              const isSelected = selected.has(item.id)
              return (
                <li key={item.id} className={`group relative aspect-square ${isSelected ? 'bg-accent/15' : 'bg-neutral-200'}`}>
                  <button
                    type="button"
                    aria-label={item.caption || 'Foto'}
                    aria-pressed={selecting ? isSelected : undefined}
                    onClick={() => onTileClick(item)}
                    onPointerDown={(event) => onTilePointerDown(event, item)}
                    onPointerMove={onTilePointerMove}
                    onPointerUp={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onContextMenu={(event) => event.preventDefault()}
                    className="block size-full cursor-pointer overflow-hidden select-none [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                  >
                    <img
                      src={mediaUrl(item)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className={`size-full object-cover transition duration-200 ${isSelected ? 'scale-[0.86] rounded-md' : 'group-hover:brightness-95'}`}
                      style={{ objectPosition: `${item.focal_x * 100}% ${item.focal_y * 100}%` }}
                    />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={() => toggle(item.id)}
                    className={`absolute left-1.5 top-1.5 grid size-7 place-items-center rounded-full ring-2 ring-white transition ${
                      isSelected ? 'bg-accent text-white' : 'bg-black/25 text-transparent hover:text-white/80'
                    } ${selecting ? '' : 'opacity-0 group-hover:opacity-100 pointer-coarse:hidden'}`}
                  >
                    <IconCheck width={16} height={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {selecting && (
        <nav
          aria-label="Acciones de la selección"
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex justify-around rounded-full bg-ink/95 p-1.5 text-paper shadow-lift backdrop-blur sm:hidden"
        >
          {selectionActions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              className="flex min-h-12 grow flex-col items-center justify-center rounded-full text-[11px] font-medium transition active:bg-white/10 disabled:opacity-40"
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </nav>
      )}

      <PhotoViewer photos={photos} index={viewIndex === -1 ? null : viewIndex} onIndexChange={showIndex} onClose={closeViewer} />
      <ConfirmDialog
        open={confirmDelete}
        title={selected.size === 1 ? '¿Quitar esta foto?' : `¿Quitar ${selected.size} fotos?`}
        message="Se eliminarán del libro de forma permanente."
        confirmLabel="Quitar"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          actions.removeMany.mutate([...selected])
          setConfirmDelete(false)
          stopSelecting()
        }}
      />
    </div>
  )
}
