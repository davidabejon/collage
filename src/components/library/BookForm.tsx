import { useState, type FormEvent } from 'react'
import { Button } from '../../ui/Button'
import { ColorField } from '../../ui/ColorField'
import { COVER_COLORS } from '../../lib/design'

type Props = {
  initialTitle?: string
  initialCover?: string
  allowCollaborator?: boolean
  submitLabel: string
  busy?: boolean
  error?: string
  onSubmit: (title: string, cover: string, collaborator?: string) => void
}

export function BookForm({ initialTitle = '', initialCover = COVER_COLORS[0], allowCollaborator = false, submitLabel, busy, error, onSubmit }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [cover, setCover] = useState(initialCover)
  const [collaborator, setCollaborator] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (title.trim()) onSubmit(title.trim(), cover, collaborator.trim() || undefined)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="relative h-24 w-18 shrink-0 rounded-l-[3px] rounded-r-lg shadow-book transition-colors"
          style={{ backgroundColor: cover }}
        >
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
