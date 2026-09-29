import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, type KeyboardEventHandler, type ReactNode } from 'react'
import type { Item, ItemUpdate } from '../../api/types'
import { IconGrip } from '../../ui/icons'
import { ItemView } from './ItemView'

type Props = {
  items: Item[]
  textColor: string
  trailing?: ReactNode
  onReorder: (items: Item[]) => void
  onUpdate: (id: number, data: ItemUpdate) => void
  onDelete: (item: Item) => void
  onOpen: (item: Item) => void
}

const kindOf = (items: Item[], id: UniqueIdentifier) => (items.find((i) => i.id === id)?.type === 'note' ? 'nota' : 'foto')
const positionOf = (items: Item[], id: UniqueIdentifier) =>
  `posición ${items.findIndex((i) => i.id === id) + 1} de ${items.length}`

export function SortableGrid({ items, textColor, trailing, onReorder, onUpdate, onDelete, onOpen }: Props) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const active = items.find((i) => i.id === activeId)

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    onReorder(arrayMove(items, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }: DragStartEvent) => {
        setActiveId(active.id)
        navigator.vibrate?.(10)
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'Pulsa espacio para coger el elemento, usa las flechas para moverlo y espacio de nuevo para soltarlo.',
        },
        announcements: {
          onDragStart: ({ active }) => `Has cogido la ${kindOf(items, active.id)} en ${positionOf(items, active.id)}.`,
          onDragOver: ({ over }) => (over ? `Sobre la ${positionOf(items, over.id)}.` : ''),
          onDragEnd: ({ over }) => (over ? `Soltado en la ${positionOf(items, over.id)}.` : 'Soltado.'),
          onDragCancel: () => 'Movimiento cancelado.',
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <ul className="grid grid-cols-2 items-start gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              textColor={textColor}
              onUpdate={(data) => onUpdate(item.id, data)}
              onDelete={() => onDelete(item)}
              onOpen={() => onOpen(item)}
            />
          ))}
          {trailing}
        </ul>
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {active && <ItemView item={active} textColor={textColor} lifted />}
      </DragOverlay>
    </DndContext>
  )
}

type SortableItemProps = {
  item: Item
  textColor: string
  onUpdate: (data: ItemUpdate) => void
  onDelete: () => void
  onOpen: () => void
}

function SortableItem({ item, textColor, onUpdate, onDelete, onOpen }: SortableItemProps) {
  const [editing, setEditing] = useState(false)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: editing,
  })
  const { onKeyDown, ...pointerListeners } = listeners ?? {}

  return (
    <li
      ref={setNodeRef}
      {...pointerListeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group relative touch-manipulation select-none ${isDragging ? 'opacity-25' : ''} ${editing ? '' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <ItemView
        item={item}
        textColor={textColor}
        onEditingChange={setEditing}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onOpen={onOpen}
      />
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        onKeyDown={onKeyDown as KeyboardEventHandler | undefined}
        aria-label={`Mover ${item.type === 'note' ? 'nota' : 'foto'}`}
        className="absolute -left-2 -top-3 z-10 grid size-9 place-items-center rounded-full bg-white/95 text-ink-soft opacity-0 shadow-md ring-1 ring-black/5 transition focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:hidden"
      >
        <IconGrip width={16} height={16} />
      </button>
    </li>
  )
}
