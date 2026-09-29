import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../ui/Button'
import { ColorField } from '../../ui/ColorField'
import { IconCamera, IconTrash } from '../../ui/icons'
import { COVER_COLORS } from '../../lib/design'

type AlbumPhoto = { id: number; url: string; label: string }

type Props = {
  initialTitle?: string
  initialCover?: string
  initialCoverImage?: string
  albumPhotos?: AlbumPhoto[]
  allowCollaborator?: boolean
  submitLabel: string
  busy?: boolean
  error?: string
  onSubmit: (title: string, cover: string, collaborator?: string, coverImage?: File, coverItemId?: number, removeCover?: boolean) => void
}

export function BookForm({ initialTitle = '', initialCover = COVER_COLORS[0], initialCoverImage, albumPhotos = [], allowCollaborator = false, submitLabel, busy, error, onSubmit }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [cover, setCover] = useState(initialCover)
  const [collaborator, setCollaborator] = useState('')
  const [selectedCover, setSelectedCover] = useState<{ file: File; preview: string } | null>(null)
  const [selectedAlbumPhoto, setSelectedAlbumPhoto] = useState<number | null>(null)
  const [removeCover, setRemoveCover] = useState(false)
  const coverPreview = selectedCover?.preview ?? albumPhotos.find((photo) => photo.id === selectedAlbumPhoto)?.url ?? (removeCover ? undefined : initialCoverImage)

  useEffect(() => () => {
    if (selectedCover) URL.revokeObjectURL(selectedCover.preview)
  }, [selectedCover])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (title.trim()) onSubmit(title.trim(), cover, collaborator.trim() || undefined, selectedCover?.file, selectedAlbumPhoto ?? undefined, removeCover)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-4">
        <div aria-hidden="true" className="relative h-24 w-18 shrink-0 overflow-hidden rounded-l-[3px] rounded-r-lg shadow-book transition-colors" style={{ backgroundColor: cover }}>
          {coverPreview && <img src={coverPreview} alt="" className="absolute inset-0 size-full object-cover" />}
          <span className="absolute inset-y-0 left-0 w-2 rounded-l-[3px] bg-black/25" />
          <span className="absolute left-3 right-2 top-5 h-8 bg-paper" />
        </div>
        <div className="grow">
          <label htmlFor="book-title" className="text-sm font-medium text-ink-soft">
            Título
          </label>
          <input
            id="book-title"
            autoFocus
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Verano en la costa"
            className="mt-1 w-full rounded-xl border border-line bg-white/80 px-4 py-3 font-hand text-2xl leading-none outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      <ColorField label="Color de la tapa" value={cover} colors={COVER_COLORS} onChange={setCover} />

      {albumPhotos.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-ink-soft">Elegir una foto del álbum</legend>
          <div className="mt-2 grid max-h-44 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
            {albumPhotos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                aria-label={`Usar ${photo.label} como portada`}
                aria-pressed={selectedAlbumPhoto === photo.id}
                onClick={() => {
                  setSelectedCover(null)
                  setSelectedAlbumPhoto(photo.id)
                  setRemoveCover(false)
                }}
                className={`aspect-square overflow-hidden rounded-md ring-2 transition ${selectedAlbumPhoto === photo.id ? 'ring-accent' : 'ring-transparent hover:ring-line'}`}
              >
                <img src={photo.url} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor="book-cover-image" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-white/80 px-4 text-sm font-medium text-ink ring-1 ring-line transition hover:bg-white">
          <IconCamera width={18} height={18} />
          {selectedCover || selectedAlbumPhoto !== null || initialCoverImage ? 'Cambiar imagen de portada' : 'Elegir imagen de portada'}
        </label>
        <input
          id="book-cover-image"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              setSelectedAlbumPhoto(null)
              setRemoveCover(false)
              setSelectedCover({ file, preview: URL.createObjectURL(file) })
            }
            event.target.value = ''
          }}
        />
        {selectedCover && <p className="mt-1 truncate text-xs text-ink-soft">{selectedCover.file.name}</p>}
        {(initialCoverImage || selectedCover || selectedAlbumPhoto !== null) && (
          <button
            type="button"
            onClick={() => {
              setSelectedCover(null)
              setSelectedAlbumPhoto(null)
              setRemoveCover(true)
            }}
            className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-red-800 transition hover:bg-red-50"
          >
            <IconTrash width={16} height={16} /> Quitar imagen de portada
          </button>
        )}
      </div>

      {allowCollaborator && (
        <div>
          <label htmlFor="book-collaborator" className="text-sm font-medium text-ink-soft">Crear con otro usuario (opcional)</label>
          <input
            id="book-collaborator"
            value={collaborator}
            onChange={(e) => setCollaborator(e.target.value)}
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9_.-]+"
            placeholder="Nombre de usuario"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-line bg-white/80 px-4 py-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={busy || !title.trim()}>
        {submitLabel}
      </Button>
    </form>
  )
}
