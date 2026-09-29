import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { ApiError } from './api/client'
import { ME_KEY } from './auth/useAuth'
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute'
import { AuthPage } from './pages/AuthPage'
import { BookPage } from './pages/BookPage'
import { LibraryPage } from './pages/LibraryPage'
import { ToastProvider } from './ui/ToastProvider'

const onUnauthorized = (err: unknown) => {
  if (err instanceof ApiError && err.status === 401) queryClient.setQueryData(ME_KEY, null)
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onUnauthorized }),
  mutationCache: new MutationCache({ onError: onUnauthorized }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<GuestRoute><AuthPage mode="login" /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><AuthPage mode="register" /></GuestRoute>} />
            <Route path="/" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
            <Route path="/books/:id" element={<ProtectedRoute><BookPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
