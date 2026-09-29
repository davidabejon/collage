import { useState } from 'react'
import type { BookSummary } from '../../api/types'
import { useDeleteBook, useUpdateBook } from '../../api/queries'
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
  const update = useUpdateBook(book.id)
  const remove = useDeleteBook()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <BookForm
        initialTitle={book.title}
        initialCover={book.cover_color}
        submitLabel="Guardar"
        busy={update.isPending}
        error={update.error?.message}
        onSubmit={(title, cover_color) => update.mutate({ title, cover_color }, { onSuccess: onClose })}
      />
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mx-auto mt-4 flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-red-800 hover:bg-red-50"
      >
        <IconTrash width={18} height={18} /> Eliminar libro
      </button>

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
