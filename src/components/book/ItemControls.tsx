import {
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { stopDrag } from './stopDrag'

export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div
      {...stopDrag}
      className="absolute -right-2 -top-3 z-10 flex gap-1 opacity-0 transition hover:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100"
    >
      {children}
    </div>
  )
}

export function ActionButton({ label, onClick, className = '', children }: { label: string; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-9 place-items-center rounded-full bg-white/95 text-ink shadow-md ring-1 ring-black/5 transition hover:scale-110 hover:text-accent ${className}`}
    >
      {children}
    </button>
  )
}

type InlineTextProps = {
  value: string
  placeholder: string
  maxLength: number
  multiline?: boolean
  className?: string
  style?: CSSProperties
  onEditingChange: (editing: boolean) => void
  onSave: (value: string) => void
  children: ReactNode
}

/** Displays `children`; on click swaps to an input and saves on blur/Enter. */
export function InlineText({
  value,
  placeholder,
  maxLength,
  multiline,
  className = '',
  style,
  onEditingChange,
  onSave,
  children,
}: InlineTextProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const start = () => {
    setDraft(value)
    onEditingChange(true)
  }
  const finish = (save: boolean) => {
    if (save && draft !== null && draft !== value) onSave(draft.trim())
    setDraft(null)
    onEditingChange(false)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') finish(false)
    if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      finish(true)
    }
  }

  if (draft === null) {
    return (
      <button type="button" {...stopDrag} onClick={start} className={`${className} text-left`} style={style}>
        {children}
      </button>
    )
  }

  const common = {
    autoFocus: true,
    value: draft,
    maxLength,
    placeholder,
    'aria-label': placeholder,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: () => finish(true),
    onKeyDown,
    onMouseDown: stopDrag.onMouseDown,
    onTouchStart: stopDrag.onTouchStart,
    onFocus: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      e.target.setSelectionRange(e.target.value.length, e.target.value.length),
    className: `${className} select-text bg-transparent outline-none placeholder:text-current placeholder:opacity-40`,
    style,
  }
  return multiline ? <textarea {...common} className={`${common.className} resize-none`} /> : <input {...common} />
}
