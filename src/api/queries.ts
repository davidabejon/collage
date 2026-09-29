import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { booksApi } from './endpoints'
import type { BookDetail, BookSummary, BookUpdate } from './types'

export const keys = {
  books: ['books'] as const,
  book: (id: number) => ['books', id] as const,
}

export const useBooks = () => useQuery({ queryKey: keys.books, queryFn: booksApi.list })

export const useBook = (id: number) =>
  useQuery({ queryKey: keys.book(id), queryFn: () => booksApi.get(id), enabled: Number.isFinite(id) })

export function useCreateBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ title, cover }: { title: string; cover: string }) => booksApi.create(title, cover),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.books, exact: true }),
  })
}

export function useUpdateBook(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BookUpdate) => booksApi.update(id, data),
    onMutate: (data) => {
      qc.setQueryData<BookDetail>(keys.book(id), (old) => (old ? { ...old, ...data } : old))
      qc.setQueryData<BookSummary[]>(keys.books, (old) => old?.map((b) => (b.id === id ? { ...b, ...data } : b)))
    },
    onError: () => qc.invalidateQueries({ queryKey: keys.books }),
  })
}

export function useDeleteBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: booksApi.remove,
    onSuccess: (_void, id) => {
      qc.setQueryData<BookSummary[]>(keys.books, (old) => old?.filter((b) => b.id !== id))
      qc.removeQueries({ queryKey: keys.book(id) })
    },
  })
}
