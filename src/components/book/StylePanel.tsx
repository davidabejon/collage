import { useQueryClient } from '@tanstack/react-query'
import { useRef, type CSSProperties } from 'react'
import { booksApi } from '../../api/endpoints'
import { keys } from '../../api/queries'
import type { BookDetail, BookUpdate } from '../../api/types'
import { PAGE_COLORS, TEXT_COLORS, contrastRatio } from '../../lib/design'
import { useDebouncedCallback } from '../../lib/useDebouncedCallback'
import { ColorField } from '../../ui/ColorField'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toast'

type Props = { book: BookDetail; open: boolean; onClose: () => void }

export function StylePanel({ book, open, onClose }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const pending = useRef<BookUpdate>({})

  const save = useDebouncedCallback(() => {
    const patch = pending.current
    pending.current = {}
    booksApi.update(book.id, patch).catch((err: Error) => {
      toast(err.message, 'error')
      qc.invalidateQueries({ queryKey: keys.book(book.id) })
    })
    qc.invalidateQueries({ queryKey: keys.books, exact: true })
  }, 400)

  const change = (patch: BookUpdate) => {
    qc.setQueryData<BookDetail>(keys.book(book.id), (old) => (old ? { ...old, ...patch } : old))
    pending.current = { ...pending.current, ...patch }
    save()
  }

  const lowContrast = contrastRatio(book.bg_color, book.text_color) < 3

  return (
    <Modal open={open} onClose={onClose} title="Estilo del libro" sheet>
      <div
        className="paper mb-5 rounded-2xl p-4 ring-1 ring-black/5"
        style={{ '--book-bg': book.bg_color, color: book.text_color } as CSSProperties}
        aria-hidden="true"
      >
        <p className="font-hand text-3xl leading-none">{book.title}</p>
        <p className="mt-1 text-sm opacity-75">Así se verá la letra sobre el papel</p>
      </div>

      <div className="space-y-5">
        <ColorField label="Color del papel" value={book.bg_color} colors={PAGE_COLORS} onChange={(bg_color) => change({ bg_color })} />
        <ColorField label="Color de la letra" value={book.text_color} colors={TEXT_COLORS} onChange={(text_color) => change({ text_color })} />
      </div>

      <p
        role="status"
        className={`mt-4 rounded-lg px-3 py-2 text-sm ${lowContrast ? 'bg-amber-100 text-amber-900' : 'sr-only'}`}
      >
        {lowContrast ? 'Poco contraste: el texto puede leerse con dificultad.' : ''}
      </p>
    </Modal>
  )
}
