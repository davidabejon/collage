import { json, request } from './client'
import type { BookDetail, BookSummary, BookUpdate, Item, ItemUpdate, User } from './types'

export const authApi = {
  me: () => request<User>('/auth/me'),
  login: (username: string, password: string) =>
    request<User>('/auth/login', { method: 'POST', body: json({ username, password }) }),
  register: (username: string, password: string) =>
    request<User>('/auth/register', { method: 'POST', body: json({ username, password }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
}

export const booksApi = {
  list: () => request<BookSummary[]>('/books'),
  get: (id: number) => request<BookDetail>(`/books/${id}`),
  create: (title: string, cover_color: string) =>
    request<BookSummary>('/books', { method: 'POST', body: json({ title, cover_color }) }),
  update: (id: number, data: BookUpdate) =>
    request<BookSummary>(`/books/${id}`, { method: 'PATCH', body: json(data) }),
  remove: (id: number) => request<void>(`/books/${id}`, { method: 'DELETE' }),
  reorder: (id: number, itemIds: number[]) =>
    request<void>(`/books/${id}/order`, { method: 'PUT', body: json({ item_ids: itemIds }) }),
  uploadPhotos: (id: number, files: File[]) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return request<Item[]>(`/books/${id}/photos`, { method: 'POST', body: form })
  },
  addNote: (id: number, note_color: string, text = '') =>
    request<Item>(`/books/${id}/notes`, { method: 'POST', body: json({ text, note_color }) }),
}

export const itemsApi = {
  update: (id: number, data: ItemUpdate) =>
    request<Item>(`/items/${id}`, { method: 'PATCH', body: json(data) }),
  remove: (id: number) => request<void>(`/items/${id}`, { method: 'DELETE' }),
}

export const mediaUrl = (itemId: number, size: 'thumb' | 'full' = 'thumb') => `/api/media/${itemId}?size=${size}`
