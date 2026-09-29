import { Link } from 'react-router'
import type { BookSummary } from '../../api/types'
import { tiltFor } from '../../lib/design'
import { IconDots } from '../../ui/icons'

type Props = { book: BookSummary; onEdit: () => void }

export function BookCover({ book, onEdit }: Props) {
  const count = book.item_count
  return (
    <div className="group relative [perspective:900px]">
      <Link
        to={`/books/${book.id}`}
        className="relative block aspect-[3/4] origin-left rounded-l-[4px] rounded-r-xl shadow-book transition duration-300 ease-out group-hover:-translate-y-1 group-hover:[transform:rotateY(-8deg)] focus-visible:-translate-y-1"
        style={{ backgroundColor: book.cover_color }}
      >
        {/* spine, page edges and cloth sheen */}
        <span className="absolute inset-y-0 left-0 w-4 rounded-l-[4px] bg-linear-to-r from-black/35 via-black/10 to-white/10" />
        <span className="absolute inset-y-2 -right-1 w-1.5 rounded-r-sm bg-[repeating-linear-gradient(0deg,#f4ecdd_0_2px,#e2d5bd_2px_3px)]" />
        <span className="absolute inset-0 rounded-r-xl bg-linear-to-br from-white/15 via-transparent to-black/20" />

        <span
          className="absolute left-7 right-4 top-[18%] flex min-h-20 flex-col justify-center bg-paper px-3 py-2 text-center shadow-sm"
          style={{ rotate: `${tiltFor(book.id, 2)}deg` }}
        >
          <span className="line-clamp-3 font-hand text-2xl leading-6 text-ink sm:text-[1.7rem] sm:leading-7">
            {book.title}
          </span>
        </span>

        <span className="absolute bottom-3 left-7 right-3 text-xs font-medium text-white/80">
          {count === 0 ? 'En blanco' : `${count} ${count === 1 ? 'recuerdo' : 'recuerdos'}`}
        </span>
      </Link>

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Opciones de «${book.title}»`}
        className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full bg-black/25 text-white opacity-100 backdrop-blur-sm transition hover:bg-black/40 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 pointer-coarse:opacity-100"
      >
        <IconDots />
      </button>
    </div>
  )
}
