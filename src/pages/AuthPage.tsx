import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuthActions } from '../auth/useAuth'
import { Button, Spinner } from '../ui/Button'

type Mode = 'login' | 'register'

const COPY: Record<Mode, { title: string; submit: string; switchText: string; switchLink: string; to: string }> = {
  login: {
    title: 'Abre tu biblioteca',
    submit: 'Entrar',
    switchText: '¿Aún no tienes cuenta?',
    switchLink: 'Crear una',
    to: '/register',
  },
  register: {
    title: 'Empieza tu primer libro',
    submit: 'Crear cuenta',
    switchText: '¿Ya tienes cuenta?',
    switchLink: 'Entrar',
    to: '/login',
  },
}

function safeRedirect(from: unknown): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}

export function AuthPage({ mode }: { mode: Mode }) {
  const copy = COPY[mode]
  const { login, register } = useAuthActions()
  const mutation = mode === 'login' ? login : register
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    mutation.mutate(
      { username: username.trim(), password },
      { onSuccess: () => navigate(safeRedirect(location.state?.from), { replace: true }) },
    )
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Decoration />

        <div className="relative rounded-r-2xl rounded-l-md bg-accent p-1.5 pl-4 shadow-book">
          <div className="absolute inset-y-0 left-0 w-3 rounded-l-md bg-black/20" aria-hidden="true" />
          <form onSubmit={submit} className="paper rounded-r-xl rounded-l-sm p-6 sm:p-8" noValidate>
            <h1 className="font-hand text-4xl leading-none text-ink">{copy.title}</h1>
            <p className="mt-2 text-sm text-ink-soft">Tus recuerdos, pegados a mano.</p>

            <label className="mt-6 block text-sm font-medium" htmlFor="username">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              minLength={3}
              maxLength={32}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-white/80 px-4 py-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />

            <label className="mt-4 block text-sm font-medium" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={mode === 'register' ? 'password-hint' : undefined}
              className="mt-1 w-full rounded-xl border border-line bg-white/80 px-4 py-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            {mode === 'register' && (
              <p id="password-hint" className="mt-1 text-xs text-ink-soft">
                Mínimo 8 caracteres.
              </p>
            )}

            {mutation.error && (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                {mutation.error.message}
              </p>
            )}

            <Button
              type="submit"
              className="mt-6 w-full"
              disabled={mutation.isPending || username.trim().length < 3 || password.length < (mode === 'register' ? 8 : 1)}
            >
              {mutation.isPending ? <Spinner className="size-4" /> : copy.submit}
            </Button>

            <p className="mt-5 text-center text-sm text-ink-soft">
              {copy.switchText}{' '}
              <Link to={copy.to} state={location.state} className="font-medium text-accent underline-offset-4 hover:underline">
                {copy.switchLink}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}

function Decoration() {
  return (
    <div className="relative mx-auto mb-[-1.75rem] h-28 w-56" aria-hidden="true">
      <div className="absolute left-2 top-4 h-24 w-20 -rotate-12 bg-white p-1.5 pb-5 shadow-polaroid">
        <div className="h-full bg-linear-to-br from-amber-200 to-rose-300" />
      </div>
      <div className="absolute right-4 top-0 h-24 w-20 rotate-6 bg-white p-1.5 pb-5 shadow-polaroid">
        <div className="h-full bg-linear-to-br from-sky-200 to-emerald-200" />
      </div>
      <div className="postit-fold absolute left-1/2 top-6 z-10 grid size-16 -translate-x-1/2 rotate-3 place-items-center bg-[#fff176] font-hand text-lg shadow-polaroid">
        ¡hola!
      </div>
    </div>
  )
}
