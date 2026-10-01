import { useMutation, useQueryClient } from '@tanstack/react-query'
import { booksApi, itemsApi } from '../../api/endpoints'
import { keys } from '../../api/queries'
import type { BookDetail, Item, ItemUpdate } from '../../api/types'
import { useToast } from '../../ui/toast'

export function useBookItems(bookId: number) {
  const qc = useQueryClient()
  const toast = useToast()
  const key = keys.book(bookId)

  const setItems = (fn: (items: Item[]) => Item[]) =>
    qc.setQueryData<BookDetail>(key, (old) => (old ? { ...old, items: fn(old.items) } : old))

  const refreshOnError = (err: Error) => {
    toast(err.message, 'error')
    qc.invalidateQueries({ queryKey: key })
  }
  const touchLibrary = () => qc.invalidateQueries({ queryKey: keys.books, exact: true })

  const addNote = useMutation({
    mutationFn: (color: string) => booksApi.addNote(bookId, color),
    onSuccess: (item) => {
      setItems((items) => [...items, item])
      touchLibrary()
    },
    onError: refreshOnError,
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ItemUpdate }) => itemsApi.update(id, data),
    onMutate: ({ id, data }) => setItems((items) => items.map((i) => (i.id === id ? { ...i, ...data } : i))),
    onError: refreshOnError,
  })

  const remove = useMutation({
    mutationFn: itemsApi.remove,
    onMutate: (id) => setItems((items) => items.filter((i) => i.id !== id)),
    onSuccess: touchLibrary,
    onError: refreshOnError,
  })

  const removeMany = useMutation({
    mutationFn: (ids: number[]) => booksApi.removeItems(bookId, ids),
    onMutate: (ids) => setItems((items) => items.filter((i) => !ids.includes(i.id))),
    onSuccess: touchLibrary,
    onError: refreshOnError,
  })

  const reorder = useMutation({
    mutationFn: (items: Item[]) => booksApi.reorder(bookId, items.map((i) => i.id)),
    onMutate: (items) => setItems(() => items),
    onError: refreshOnError,
  })

  const upload = async (files: File[]) => {
    const created = await booksApi.uploadPhotos(bookId, files)
    setItems((items) => [...items, ...created])
    touchLibrary()
  }

  return { addNote, update, remove, removeMany, reorder, upload }
}
