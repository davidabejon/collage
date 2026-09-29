import { useState, type CSSProperties } from 'react'
import { mediaUrl } from '../../api/endpoints'
import type { Item, ItemUpdate } from '../../api/types'
import { NOTE_COLORS, readableOn, tiltFor } from '../../lib/design'
import { IconExpand, IconPalette, IconTrash } from '../../ui/icons'
import { ActionBar, ActionButton, InlineText } from './ItemControls'
import { stopDrag } from './stopDrag'

export type ItemViewProps = {
  item: Item
  textColor: string
  lifted?: boolean
  onEditingChange?: (editing: boolean) => void
  onUpdate?: (data: ItemUpdate) => void
  onDelete?: () => void
  onOpen?: () => void
}

const tiltStyle = (id: number, lifted?: boolean) => ({
  rotate: `${lifted ? tiltFor(id) * 0.3 + 2 : tiltFor(id)}deg`,
  scale: lifted ? '1.04' : undefined,
})

export function ItemView(props: ItemViewProps) {
  return props.item.type === 'photo' ? <Polaroid {...props} /> : <PostIt {...props} />
}

function Polaroid({ item, textColor, lifted, onEditingChange, onUpdate, onDelete, onOpen }: ItemViewProps) {
  const color = readableOn('#ffffff', textColor)
  return (
    <figure
      className={`relative bg-white p-2 pb-0 transition-[rotate,scale,box-shadow] duration-200 sm:p-2.5 sm:pb-0 ${lifted ? 'shadow-lift' : 'shadow-polaroid'}`}
      style={{ ...tiltStyle(item.id, lifted), '--tape-rotate': `${tiltFor(item.id + 7, 6)}deg` } as CSSProperties}
    >
      <span className="tape" aria-hidden="true" />
      <div className="aspect-square overflow-hidden bg-neutral-200">
        <img
          src={mediaUrl(item)}
          alt={item.caption || 'Foto'}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="size-full animate-[develop_1.2s_ease-out] select-none object-cover [-webkit-touch-callout:none]"
        />
      </div>
      <figcaption className="flex h-11 items-center justify-center px-1 sm:h-13">
        {onUpdate ? (
          <InlineText
            value={item.caption}
            placeholder="Pie de foto…"
            maxLength={140}
            className="w-full truncate text-center font-hand text-xl leading-none sm:text-2xl"
            style={{ color }}
            onEditingChange={(e) => onEditingChange?.(e)}
            onSave={(caption) => onUpdate({ caption })}
          >
            {item.caption || (
              <span className="opacity-0 transition group-hover:opacity-40 pointer-coarse:opacity-30">Pie de foto…</span>
            )}
          </InlineText>
        ) : (
          <span className="truncate font-hand text-xl sm:text-2xl" style={{ color }}>
            {item.caption}
          </span>
        )}
      </figcaption>

      {onDelete && onOpen && (
        <ActionBar>
          <ActionButton label="Ver en grande" onClick={onOpen}>
            <IconExpand width={16} height={16} />
          </ActionButton>
          <ActionButton label="Quitar foto" onClick={onDelete}>
            <IconTrash width={16} height={16} />
          </ActionButton>
        </ActionBar>
      )}
    </figure>
  )
}

function noteSize(text: string) {
  if (text.length < 30) return 'text-2xl sm:text-3xl'
  if (text.length < 90) return 'text-xl sm:text-2xl'
  if (text.length < 200) return 'text-lg sm:text-xl'
  return 'text-base sm:text-lg'
}

function PostIt({ item, textColor, lifted, onEditingChange, onUpdate, onDelete }: ItemViewProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const color = readableOn(item.note_color, textColor)
  const textClass = `size-full whitespace-pre-wrap break-words font-hand leading-tight ${noteSize(item.text)}`

  return (
    <div
      className={`postit-fold relative aspect-square p-3 transition-[rotate,scale,box-shadow] duration-200 animate-[stick_.25s_ease-out] sm:p-4 ${lifted ? 'shadow-lift' : 'shadow-polaroid'}`}
      style={{ ...tiltStyle(item.id, lifted), backgroundColor: item.note_color, color }}
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-5 bg-black/[0.04]" />
      {onUpdate ? (
        <InlineText
          value={item.text}
          placeholder="Escribe algo…"
          maxLength={500}
          multiline
          className={`${textClass} overflow-y-auto`}
          onEditingChange={(e) => onEditingChange?.(e)}
          onSave={(text) => onUpdate({ text })}
        >
          {item.text || <span className="opacity-40">Escribe algo…</span>}
        </InlineText>
      ) : (
        <p className={`${textClass} overflow-hidden`}>{item.text}</p>
      )}

      {onDelete && onUpdate && (
        <ActionBar>
          <ActionButton label="Cambiar color" onClick={() => setPaletteOpen((o) => !o)}>
            <IconPalette width={16} height={16} />
          </ActionButton>
          <ActionButton label="Quitar nota" onClick={onDelete}>
            <IconTrash width={16} height={16} />
          </ActionButton>
        </ActionBar>
      )}

      {paletteOpen && onUpdate && (
        <div
          {...stopDrag}
          role="group"
          aria-label="Color de la nota"
          className="absolute inset-x-2 bottom-2 z-10 flex flex-wrap justify-center gap-1.5 rounded-2xl bg-white/95 p-2 shadow-lg"
        >
          {NOTE_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={c.label}
              aria-pressed={c.value === item.note_color}
              onClick={() => {
                onUpdate({ note_color: c.value })
                setPaletteOpen(false)
              }}
              className="size-8 rounded-full ring-1 ring-black/10 transition hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-ink"
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
