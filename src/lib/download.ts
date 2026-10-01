import { mediaUrl } from '../api/endpoints'
import type { Item } from '../api/types'

export function downloadPhoto(item: Item) {
  const link = document.createElement('a')
  link.href = mediaUrl(item, 'full')
  link.download = `foto-${item.id}.webp`
  document.body.append(link)
  link.click()
  link.remove()
}

// Staggered so browsers don't drop rapid consecutive downloads.
export function downloadPhotos(items: Item[]) {
  items.forEach((item, i) => setTimeout(() => downloadPhoto(item), i * 150))
}
