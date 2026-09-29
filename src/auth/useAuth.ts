import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { authApi } from '../api/endpoints'
import type { User } from '../api/types'

export const ME_KEY = ['me'] as const

export function useMe() {
  return useQuery<User | null>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await authApi.me()
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
    staleTime: Infinity,
  })
}

export function useAuthActions() {
  const qc = useQueryClient()
  const onAuth = (user: User) => qc.setQueryData(ME_KEY, user)

  const login = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) => authApi.login(username, password),
    onSuccess: onAuth,
  })
  const register = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.register(username, password),
    onSuccess: onAuth,
  })
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      qc.clear()
      qc.setQueryData(ME_KEY, null)
    },
  })

  return { login, register, logout }
}
