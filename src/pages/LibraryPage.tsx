import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useBooks, useCreateBook } from '../api/queries'
import type { BookSummary } from '../api/types'
import { useAuthActions, useMe } from '../auth/useAuth'
import { BookCover } from '../components/library/BookCover'
import { BookForm } from '../components/library/BookForm'
import { BookSettingsDialog } from '../components/library/BookSettingsDialog'
import { Button, IconButton } from '../ui/Button'
import { IconLogout, IconPlus } from '../ui/icons'
import { Modal } from '../ui/Modal'

export function LibraryPage() {
  const { data: user } = useMe()
  const { logout } = useAuthActions()
  const books = useBooks()
  const create = useCreateBook()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<BookSummary | null>(null)

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 pb-16 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-5 sm:py-8">
        <div>
          <p className="font-hand text-xl text-ink-soft">Biblioteca de {user?.username}</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Collage</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button className="hidden sm:inline-flex" onClick={() => setCreating(true)}>
            <IconPlus width={18} height={18} /> Nuevo libro
          </Button>
          <IconButton label="Cerrar sesión" onClick={() => logout.mutate()}>
            <IconLogout />
          </IconButton>
        </div>
      </header>

      {books.isPending && <ShelfSkeleton />}

      {books.isError && (
        <div className="py-20 text-center">
          <p className="text-ink-soft">{books.error.message}</p>
          <Button variant="secondary" className="mt-4" onClick={() => books.refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {books.data && books.data.length === 0 && <EmptyLibrary onCreate={() => setCreating(true)} />}

      {books.data && books.data.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-x-10 sm:gap-y-14 lg:grid-cols-4 xl:grid-cols-5">
          {books.data.map((book) => (
            <li key={book.id} className="relative pb-3">
              <BookCover book={book} onEdit={() => setEditing(book)} />
              {/* shelf plank */}
              <div aria-hidden="true" className="absolute -inset-x-3 bottom-0 h-3 rounded-sm bg-[#c9b08c] shadow-[0_6px_10px_-4px_rgb(80_50_20/0.5)] sm:-inset-x-5" />
            </li>
          ))}
          <li className="hidden pb-3 sm:block">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="grid aspect-[3/4] w-full place-items-center rounded-xl border-2 border-dashed border-ink/20 text-ink-soft transition hover:border-accent hover:text-accent"
            >
              <span className="flex flex-col items-center gap-2">
                <IconPlus width={28} height={28} />
                <span className="font-hand text-2xl">Nuevo libro</span>
              </span>
            </button>
          </li>
        </ul>
      )}

      {books.data && books.data.length > 0 && (
        <button
          type="button"
          aria-label="Nuevo libro"
          onClick={() => setCreating(true)}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-20 grid size-16 place-items-center rounded-full bg-accent text-white shadow-lift transition active:scale-95 sm:hidden"
        >
          <IconPlus width={28} height={28} />
        </button>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo libro" sheet>
        {creating && (
          <BookForm
            submitLabel="Crear libro"
            allowCollaborator
            busy={create.isPending}
            error={create.error?.message}
            onSubmit={(title, cover, collaborator) =>
              create.mutate(
                { title, cover, collaborator },
                {
                  onSuccess: (book) => {
                    setCreating(false)
                    navigate(`/books/${book.id}`)
                  },
                },
              )
            }
          />
        )}
      </Modal>

      <BookSettingsDialog book={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function EmptyLibrary({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center">
      <div aria-hidden="true" className="relative mb-8 h-40 w-32">
        <div className="absolute inset-0 -rotate-6 rounded-r-xl rounded-l-sm bg-[#2f4b3a] shadow-book" />
        <div className="absolute inset-0 rotate-3 rounded-r-xl rounded-l-sm bg-accent shadow-book">
          <span className="absolute left-5 right-3 top-8 h-12 bg-paper" />
        </div>
      </div>
      <h2 className="font-hand text-4xl">Tu estantería está vacía</h2>
      <p className="mt-2 text-ink-soft">Crea un libro y empieza a pegar fotos y notas.</p>
      <Button className="mt-6" onClick={onCreate}>
        <IconPlus width={18} height={18} /> Crear mi primer libro
      </Button>
    </div>
  )
}

function ShelfSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-x-10 lg:grid-cols-4 xl:grid-cols-5" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-ink/10" />
      ))}
    </div>
  )
}
