export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Detail = string | { msg: string }[] | undefined

function messageFrom(detail: Detail, fallback: string): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) return detail.map((d) => d.msg).join('. ')
  return fallback
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor')
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: Detail }
    throw new ApiError(res.status, messageFrom(body.detail, `Error ${res.status}`))
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const json = (data: unknown) => JSON.stringify(data)
