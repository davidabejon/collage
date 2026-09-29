import { useEffect, useMemo, useRef } from 'react'

export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  const fnRef = useRef(fn)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return useMemo(
    () =>
      (...args: A) => {
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => fnRef.current(...args), delay)
      },
    [delay],
  )
}
