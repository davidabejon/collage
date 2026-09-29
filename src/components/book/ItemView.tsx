import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { mediaUrl } from '../../api/endpoints'
import type { Item, ItemUpdate } from '../../api/types'
import { NOTE_COLORS, readableOn, tiltFor } from '../../lib/design'
import { IconCrop, IconExpand, IconPalette, IconSize, IconTrash } from '../../ui/icons'
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
  onFrame?: (aspect: number) => void
}

const tiltStyle = (id: number, lifted?: boolean) => ({
  rotate: `${lifted ? tiltFor(id) * 0.3 + 2 : tiltFor(id)}deg`,
  scale: lifted ? '1.04' : undefined,
})

export function ItemView(props: ItemViewProps) {
  return props.item.type === 'photo' ? <Polaroid {...props} /> : <PostIt {...props} />
}

function FramedPhoto({ item }: { item: Item }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0 })
  const [image, setImage] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const frameNode = frameRef.current
    if (!frameNode) return
    const observer = new ResizeObserver(([entry]) => {
      setFrame({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(frameNode)
    return () => observer.disconnect()
  }, [])

  const ready = frame.width > 0 && frame.height > 0 && image.width > 0 && image.height > 0
  const scale = ready ? Math.max(frame.width / image.width, frame.height / image.height) * item.photo_zoom : 1
  const width = image.width * scale
  const height = image.height * scale
  const left = Math.min(0, Math.max(frame.width - width, frame.width / 2 - item.focal_x * width))
  const top = Math.min(0, Math.max(frame.height - height, frame.height / 2 - item.focal_y * height))

  return (
    <div ref={frameRef} className="size-full overflow-hidden">
      <img
        src={mediaUrl(item)}
        alt={item.caption || 'Foto'}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={(event) => setImage({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        className={`absolute max-w-none animate-[develop_1.2s_ease-out] select-none [-webkit-touch-callout:none] ${ready ? '' : 'size-full object-cover'}`}
        style={ready ? { width, height, left, top } : undefined}
      />
    </div>
  )
}

function ItemSizeControls({ item, onUpdate }: { item: Item; onUpdate: (data: ItemUpdate) => void }) {
  const [sizeOpen, setSizeOpen] = useState(false)
  const sizeButtonRef = useRef<HTMLSpanElement>(null)
  const sizePanelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!sizeOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!sizePanelRef.current?.contains(target) && !sizeButtonRef.current?.contains(target)) setSizeOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setSizeOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [sizeOpen])

  return (
    <span ref={sizeButtonRef}>
      <ActionButton label="Cambiar tamaño" onClick={() => setSizeOpen((open) => !open)}>
        <IconSize width={16} height={16} />
      </ActionButton>
      {sizeOpen && (
        <div ref={sizePanelRef} {...stopDrag} className="absolute right-0 top-10 z-20 w-44 rounded-lg bg-white p-3 text-ink shadow-lg ring-1 ring-black/10">
          <p className="mb-2 text-sm font-medium">Tamaño {item.type === 'photo' ? 'de la foto' : 'del post-it'}</p>
          {([['Columnas', 'span_columns'], ['Filas', 'span_rows']] as const).map(([label, field]) => (
            <label key={field} className="mb-2 flex items-center justify-between gap-2 text-sm last:mb-0">
              {label}
              <input
                type="number"
                min={1}
                max={50}
                value={item[field]}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (Number.isInteger(next) && next >= 1 && next <= 50) onUpdate({ [field]: next })
                }}
                className="w-16 rounded border border-line px-2 py-1 text-center"
              />
            </label>
          ))}
        </div>
      )}
    </span>
  )
}

function Polaroid({ item, textColor, lifted, onEditingChange, onUpdate, onDelete, onOpen, onFrame }: ItemViewProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const color = readableOn('#ffffff', textColor)
  return (
    <figure
      className={`relative flex h-full flex-col bg-white p-2 pb-0 transition-[rotate,scale,box-shadow] duration-200 sm:p-2.5 sm:pb-0 ${lifted ? 'shadow-lift' : 'shadow-polaroid'}`}
      style={{ ...tiltStyle(item.id, lifted), '--tape-rotate': `${tiltFor(item.id + 7, 6)}deg` } as CSSProperties}
    >
      <span className="tape" aria-hidden="true" />
      <div ref={frameRef} className="relative min-h-0 flex-1 overflow-hidden bg-neutral-200">
        <FramedPhoto item={item} />
        {!onDelete && onOpen && (
          <button
            type="button"
            aria-label="Ver foto en grande"
            onClick={onOpen}
            className="absolute inset-0 z-[1] cursor-zoom-in focus-visible:outline-2 focus-visible:outline-accent"
          />
        )}
      </div>
      <figcaption className="flex h-11 min-w-0 items-center gap-1 px-1 sm:h-13">
        {onUpdate ? (
          <InlineText
            value={item.caption}
            placeholder="Pie de foto…"
            maxLength={140}
            className="min-w-0 grow truncate font-hand text-xl leading-none sm:text-2xl"
            style={{ color, textAlign: item.caption_align }}
            onEditingChange={(e) => onEditingChange?.(e)}
            onSave={(caption) => onUpdate({ caption })}
          >
            {item.caption || (
              <span className="opacity-0 transition group-hover:opacity-40 pointer-coarse:opacity-30">Pie de foto…</span>
            )}
          </InlineText>
        ) : (
          <span className="min-w-0 grow truncate font-hand text-xl sm:text-2xl" style={{ color, textAlign: item.caption_align }}>
            {item.caption}
          </span>
        )}
        {onUpdate && (
          <select
            {...stopDrag}
            aria-label="Alineación del pie"
            title="Alineación del pie"
            value={item.caption_align}
            onChange={(event) => onUpdate({ caption_align: event.target.value as Item['caption_align'] })}
            className="w-11 shrink-0 cursor-pointer rounded border border-line bg-white px-0.5 py-1 text-xs text-ink outline-none focus:border-accent sm:w-12"
          >
            <option value="left">Izq.</option>
            <option value="center">Cen.</option>
            <option value="right">Der.</option>
          </select>
        )}
      </figcaption>

      {onDelete && onOpen && (
        <ActionBar>
          <ActionButton label="Ver en grande" onClick={onOpen}>
            <IconExpand width={16} height={16} />
          </ActionButton>
          {onFrame && (
            <ActionButton label="Encuadrar foto" onClick={() => {
              const frame = frameRef.current
              if (frame?.clientWidth && frame.clientHeight) onFrame(frame.clientWidth / frame.clientHeight)
            }}>
              <IconCrop width={16} height={16} />
            </ActionButton>
          )}
          {onUpdate && <ItemSizeControls item={item} onUpdate={onUpdate} />}
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
      className={`postit-fold relative h-full p-3 transition-[rotate,scale,box-shadow] duration-200 animate-[stick_.25s_ease-out] sm:p-4 ${lifted ? 'shadow-lift' : 'shadow-polaroid'}`}
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
          <ItemSizeControls item={item} onUpdate={onUpdate} />
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
