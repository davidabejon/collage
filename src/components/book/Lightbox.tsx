import { mediaUrl } from '../../api/endpoints'
import type { Item } from '../../api/types'
import { Modal } from '../../ui/Modal'

export function Lightbox({ item, onClose }: { item: Item | null; onClose: () => void }) {
  return (
    <Modal open={item !== null} onClose={onClose} title={item?.caption || 'Foto'} className="max-w-3xl!">
      {item && (
        <div className="bg-white p-3 pb-0 shadow-polaroid">
          <img src={mediaUrl(item, 'full')} alt={item.caption || 'Foto'} className="max-h-[70dvh] w-full object-contain" />
          <p className="flex min-h-14 items-center justify-center font-hand text-3xl">{item.caption}</p>
        </div>
      )}
    </Modal>
  )
}
