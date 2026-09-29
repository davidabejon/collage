export type User = { id: number; username: string }

export type BookSummary = {
  id: number
  owner_id: number
  owner_username: string
  collaborators: User[]
  title: string
  bg_color: string
  text_color: string
  cover_color: string
  created_at: string
  updated_at: string
  item_count: number
}

export type ItemType = 'photo' | 'note'

export type Item = {
  id: number
  created_at: string
  type: ItemType
  position: number
  caption: string
  text: string
  note_color: string
}

export type BookDetail = BookSummary & { items: Item[] }

export type BookUpdate = Partial<Pick<BookSummary, 'title' | 'bg_color' | 'text_color' | 'cover_color'>>
export type ItemUpdate = Partial<Pick<Item, 'caption' | 'text' | 'note_color'>>
