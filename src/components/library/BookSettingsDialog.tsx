import { useState, type FormEvent } from 'react'
import type { BookSummary } from '../../api/types'
import { bookCoverUrl, mediaUrl } from '../../api/endpoints'
import { useAddCollaborator, useBook, useDeleteBook, useRemoveBookCover, useUpdateBook, useUploadBookCover } from '../../api/queries'
import { useMe } from '../../auth/useAuth'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { Modal } from '../../ui/Modal'
import { IconTrash } from '../../ui/icons'
import { useToast } from '../../ui/toast'
import { BookForm } from './BookForm'

type Props = {
  book: BookSummary | null
  onClose: () => void
  onDeleted?: () => void
}

export function BookSettingsDialog({ book, onClose, onDeleted }: Props) {
  return (
    <Modal open={book !== null} onClose={onClose} title="Editar libro" sheet>
      {book && <Content key={book.id} book={book} onClose={onClose} onDeleted={onDeleted} />}
    </Modal>
  )
}

function Content({ book, onClose, onDeleted }: { book: BookSummary; onClose: () => void; onDeleted?: () => void }) {
  const current = useBook(book.id)
  const update = useUpdateBook(book.id)
  const uploadCover = useUploadBookCover()
  const removeCover = useRemoveBookCover()
  const addCollaborator = useAddCollaborator(book.id)
  const remove = useDeleteBook()
  const { data: user } = useMe()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [username, setUsername] = useState('')
  const albumPhotos = (current.data?.items ?? [])
    .filter((item) => item.type === 'photo')
    .map((item, index) => ({ id: item.id, url: mediaUrl(item), label: item.caption.trim() || `Foto ${index + 1}` }))

  const addMember = (event: FormEvent) => {
    event.preventDefault()
    if (!username.trim()) return
    addCollaborator.mutate(username.trim(), {
      onSuccess: () => {
        setUsername('')
        toast('Usuario añadido al libro')
      },
    })
  }

  return (
    <>
      <BookForm
        initialTitle={book.title}
        initialCover={book.cover_color}
        initialCoverImage={book.cover_image ? bookCoverUrl(book) : undefined}
        albumPhotos={albumPhotos}
        submitLabel="Guardar"
        busy={update.isPending || uploadCover.isPending || removeCover.isPending}
        error={removeCover.error?.message ?? uploadCover.error?.message ?? update.error?.message}
        onSubmit={(title, cover_color, _collaborator, coverImage, coverItemId, shouldRemoveCover) => update.mutate({ title, cover_color }, {
          onSuccess: () => {
            if (shouldRemoveCover) {
              removeCover.mutate(book.id, { onSuccess: onClose })
              return
            }
            if (!coverImage && coverItemId === undefined) {
              onClose()
              return
            }
            const choice = coverImage
              ? { bookId: book.id, file: coverImage }
              : { bookId: book.id, itemId: coverItemId! }
            uploadCover.mutate(choice, { onSuccess: onClose })
          },
        })}
      />
      <section className="mt-6 border-t border-line pt-5">
        <h3 className="font-display text-lg font-semibold">Personas con acceso</h3>
        <ul className="mt-2 space-y-1 text-sm text-ink-soft">
          <li>{(current.data ?? book).owner_username} · dueño</li>
          {(current.data ?? book).collaborators.map((member) => <li key={member.id}>{member.username} · colaborador</li>)}
        </ul>
        <form onSubmit={addMember} className="mt-4">
          <label htmlFor="add-collaborator" className="text-sm font-medium text-ink-soft">Añadir usuario</label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              id="add-collaborator"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9_.-]+"
              placeholder="Nombre de usuario"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border border-line bg-white/80 px-4 py-2 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <Button type="submit" disabled={addCollaborator.isPending || !username.trim()}>Añadir</Button>
          </div>
          {addCollaborator.error && <p role="alert" className="mt-2 text-sm text-red-800">{addCollaborator.error.message}</p>}
        </form>
      </section>
      {book.owner_id === user?.id && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mx-auto mt-4 flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-red-800 hover:bg-red-50"
        >
          <IconTrash width={18} height={18} /> Eliminar libro
        </button>
      )}

      <ConfirmDialog
        open={confirming}
        title="¿Eliminar este libro?"
        message={`«${book.title}» y todas sus fotos y notas se borrarán para siempre.`}
        busy={remove.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(book.id, {
            onSuccess: () => {
              setConfirming(false)
              onClose()
              toast('Libro eliminado')
              onDeleted?.()
            },
            onError: (err) => toast(err.message, 'error'),
          })
        }
      />
    </>
  )
}
