import { useEffect, useRef, type ReactNode } from 'react'
import { IconClose } from './icons'
import { IconButton } from './Button'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Renders as a bottom sheet on small screens. */
  sheet?: boolean
  className?: string
}

export function Modal({ open, onClose, title, children, sheet = false, className = '' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const position = sheet
    ? 'mt-auto mb-0 w-full max-w-none rounded-t-3xl sm:m-auto sm:max-w-md sm:rounded-3xl'
    : 'm-auto w-[calc(100%-2rem)] max-w-md rounded-3xl'

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className={`bg-paper p-0 text-ink shadow-lift backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] open:animate-[pop_.18s_ease-out] ${position} ${className}`}
    >
      {open && (
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            <IconButton label="Cerrar" onClick={onClose} className="-mr-2">
              <IconClose />
            </IconButton>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
