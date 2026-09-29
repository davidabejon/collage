import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useBook } from '../api/queries'
import type { Item } from '../api/types'
import { Lightbox } from '../components/book/Lightbox'
import { PhotoCropDialog } from '../components/book/PhotoCropDialog'
import { SortableGrid } from '../components/book/SortableGrid'
import { StylePanel } from '../components/book/StylePanel'
import { useBookItems } from '../components/book/useBookItems'
import { BookSettingsDialog } from '../components/library/BookSettingsDialog'
import { NOTE_COLORS, tiltFor } from '../lib/design'
import { Button, IconButton, Spinner } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { IconBack, IconCamera, IconDots, IconEdit, IconEye, IconNote, IconPalette } from '../ui/icons'
import { useToast } from '../ui/toast'

const MAX_MB = 15
const BATCH = 20

export function BookPage() {
  const bookId = Number(useParams().id)
  const book = useBook(bookId)
  const actions = useBookItems(bookId)
  const toast = useToast()
  const navigate = useNavigate()
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [styleOpen, setStyleOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [viewing, setViewing] = useState<Item | null>(null)
  const [framing, setFraming] = useState<{ item: Item; aspect: number } | null>(null)
  const [deleting, setDeleting] = useState<Item | null>(null)

  const uploadFiles = async (list: FileList | File[]) => {
    const all = Array.from(list)
    const files = all.filter((f) => f.type.startsWith('image/') && f.size <= MAX_MB * 1024 * 1024)
    if (files.length < all.length) toast(`Algunos archivos no son imágenes o superan ${MAX_MB} MB`, 'error')
    if (!files.length) return

    setUploading((n) => n + files.length)
    for (let i = 0; i < files.length; i += BATCH) {
      const batch = files.slice(i, i + BATCH)
      try {
        await actions.upload(batch)
      } catch (err) {
        toast((err as Error).message, 'error')
      } finally {
        setUploading((n) => n - batch.length)
      }
    }
  }

  const addNote = () => {
    const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)].value
    actions.addNote.mutate(color, {
      onSuccess: () => requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })),
    })
  }

  const dragging = useFileDrop((files) => void uploadFiles(files), isEditing)

  const toggleEditing = () => {
    if (isEditing) {
      setStyleOpen(false)
      setSettingsOpen(false)
    }
    setIsEditing((editing) => !editing)
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

  const toolbarActions = [
    { label: 'Fotos', icon: <IconCamera />, onClick: () => fileInput?.click() },
    { label: 'Post-it', icon: <IconNote />, onClick: addNote, disabled: actions.addNote.isPending },
    { label: 'Estilo', icon: <IconPalette />, onClick: () => setStyleOpen(true) },
  ]

  return (
    <div className={`min-h-dvh ${isEditing ? 'pb-28 sm:pb-12' : 'pb-12'}`}>
      <header className="sticky top-0 z-30 border-b border-black/5 bg-desk/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-2 sm:px-6">
          <IconButton label="Volver a la biblioteca" onClick={() => navigate('/')}>
            <IconBack />
          </IconButton>
          <div className="flex min-w-0 grow items-center gap-3">
            <span aria-hidden="true" className="h-8 w-6 shrink-0 rounded-r-sm rounded-l-[2px] shadow-sm" style={{ backgroundColor: data.cover_color }} />
            <h1 className="truncate font-display text-lg font-semibold">{data.title}</h1>
          </div>
          {isEditing && (
            <div className="hidden items-center gap-2 sm:flex">
              {toolbarActions.map((a, i) => (
                <Button key={a.label} variant={i === 0 ? 'primary' : 'secondary'} onClick={a.onClick} disabled={a.disabled}>
                  {a.icon}
                  {a.label}
                </Button>
              ))}
            </div>
          )}
          <Button variant={isEditing ? 'secondary' : 'primary'} onClick={toggleEditing} className="shrink-0 px-3 sm:px-4">
            {isEditing ? <IconEye /> : <IconEdit />}
            {isEditing ? 'Ver álbum' : 'Editar'}
          </Button>
          {isEditing && (
            <IconButton label="Opciones del libro" onClick={() => setSettingsOpen(true)}>
              <IconDots />
            </IconButton>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 pt-4 sm:px-6 sm:pt-8">
        <article
          className="paper min-h-[calc(100dvh-10rem)] rounded-r-2xl rounded-l-md px-4 pb-12 pt-8 shadow-book transition-colors duration-300 sm:px-10 sm:pt-12"
          style={{ '--book-bg': data.bg_color, color: data.text_color } as CSSProperties}
        >
          <div className="mb-10 text-center sm:mb-14">
            <div
              className="notebook-paper relative mx-auto w-fit max-w-full -rotate-1 px-7 py-3 shadow-polaroid sm:px-10 sm:py-4"
              style={{ '--tape-rotate': `${tiltFor(data.id, 2)}deg` } as CSSProperties}
            >
              <span className="tape" aria-hidden="true" />
              <h2 className="wrap-break-word font-hand text-5xl leading-none sm:text-6xl">{data.title}</h2>
            </div>
          </div>

          {data.items.length === 0 && uploading === 0 ? (
            <EmptyBook editable={isEditing} onPhotos={() => fileInput?.click()} onNote={addNote} />
          ) : (
            <SortableGrid
              items={data.items}
              textColor={data.text_color}
              editable={isEditing}
              onReorder={(items) => actions.reorder.mutate(items)}
              onUpdate={(id, patch) => actions.update.mutate({ id, data: patch })}
              onDelete={setDeleting}
              onOpen={setViewing}
              onFrame={(item, aspect) => setFraming({ item, aspect })}
              trailing={Array.from({ length: uploading }, (_, i) => (
                <li key={`uploading-${i}`} aria-hidden="true">
                  <div className="bg-white p-2 pb-0 shadow-polaroid sm:p-2.5 sm:pb-0">
                    <div className="grid aspect-square animate-pulse place-items-center bg-neutral-800/85 font-hand text-xl text-white/70">
                      Revelando…
                    </div>
                    <div className="h-11 sm:h-13" />
                  </div>
                </li>
              ))}
            />
          )}
        </article>
        {uploading > 0 && <p className="sr-only" role="status">Subiendo {uploading} fotos</p>}
      </main>

      {isEditing && <nav
        aria-label="Acciones del libro"
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex justify-around rounded-full bg-ink/95 p-1.5 text-paper shadow-lift backdrop-blur sm:hidden"
      >
        {toolbarActions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            disabled={a.disabled}
            className="flex min-h-12 grow flex-col items-center justify-center rounded-full text-[11px] font-medium transition active:bg-white/10"
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </nav>}

      <input
        ref={setFileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-ink/40 p-6 backdrop-blur-[2px]">
          <div className="rotate-[-2deg] bg-white p-4 pb-0 shadow-lift">
            <div className="grid size-56 place-items-center border-2 border-dashed border-ink/20 text-ink-soft">
              <IconCamera width={48} height={48} />
            </div>
            <p className="py-3 text-center font-hand text-3xl">Suelta para pegar</p>
          </div>
        </div>
      )}

      <StylePanel book={data} open={isEditing && styleOpen} onClose={() => setStyleOpen(false)} />
      <BookSettingsDialog book={isEditing && settingsOpen ? data : null} onClose={() => setSettingsOpen(false)} onDeleted={() => navigate('/', { replace: true })} />
      <Lightbox item={viewing} onClose={() => setViewing(null)} />
      <PhotoCropDialog
        item={framing?.item ?? null}
        aspect={framing?.aspect ?? 1}
        saving={actions.update.isPending}
        onClose={() => setFraming(null)}
        onSave={(frame) => {
          if (framing) actions.update.mutate({ id: framing.item.id, data: frame }, { onSuccess: () => setFraming(null) })
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={deleting?.type === 'note' ? '¿Quitar esta nota?' : '¿Quitar esta foto?'}
        message="Se eliminará del libro de forma permanente."
        confirmLabel="Quitar"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.remove.mutate(deleting.id)
          setDeleting(null)
        }}
      />
    </div>
  )
}

function EmptyBook({ editable, onPhotos, onNote }: { editable: boolean; onPhotos: () => void; onNote: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-8 text-center">
      <div aria-hidden="true" className="relative mb-8 h-44 w-56">
        <div className="absolute left-4 top-2 w-32 -rotate-6 border-2 border-dashed border-current/25 p-2 pb-8 opacity-60">
          <div className="aspect-square bg-current/5" />
        </div>
        <div className="postit-fold absolute right-4 top-10 grid size-24 rotate-6 place-items-center bg-[#fff176] font-hand text-xl text-ink shadow-polaroid">
          ¡empieza!
        </div>
      </div>
      <p className="font-hand text-4xl leading-none">Tu libro está en blanco</p>
      <p className="mt-2 opacity-70">{editable ? 'Pega tu primera foto o deja una nota.' : 'Este libro todavía está en blanco.'}</p>
      {editable && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={onPhotos}>
            <IconCamera /> Añadir fotos
          </Button>
          <Button variant="secondary" onClick={onNote}>
            <IconNote /> Nuevo post-it
          </Button>
        </div>
      )}
    </div>
  )
}

function useFileDrop(onDrop: (files: FileList) => void, enabled: boolean) {
  const [dragging, setDragging] = useState(false)
  const handler = useRef(onDrop)
  useEffect(() => {
    handler.current = onDrop
  })

  useEffect(() => {
    if (!enabled) return
    let depth = 0
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setDragging(true)
    }
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      if (e.dataTransfer?.files.length) handler.current(e.dataTransfer.files)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [enabled])

  return dragging
}
