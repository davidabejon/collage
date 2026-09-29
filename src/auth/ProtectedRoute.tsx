import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useMe } from './useAuth'
import { Spinner } from '../ui/Button'

export function FullPageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center text-ink-soft">
      <Spinner className="size-8" />
    </div>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useMe()
  const location = useLocation()
  if (isPending) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useMe()
  if (isPending) return <FullPageLoader />
  if (user) return <Navigate to="/" replace />
  return children
}
