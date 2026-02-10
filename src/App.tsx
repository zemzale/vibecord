import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import {
  getSessionUserQuery,
  registerMutation,
  SESSION_TOKEN_STORAGE_KEY,
  type SessionUser,
} from './lib/auth'

function readInitialSessionToken(): string | null {
  const token = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY)
  return token && token.length > 0 ? token : null
}

function App() {
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(readInitialSessionToken)
  const [freshUser, setFreshUser] = useState<SessionUser | null>(null)

  const register = useMutation(registerMutation)
  const sessionUser = useQuery(
    getSessionUserQuery,
    sessionToken ? { sessionToken } : 'skip',
  )

  const activeUser = useMemo(
    () => (sessionUser === undefined ? freshUser : sessionUser),
    [freshUser, sessionUser],
  )

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const result = await register({
        loginName,
        password,
      })

      setFreshUser(result.user)
      setSessionToken(result.sessionToken)
      window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, result.sessionToken)
      setLoginName('')
      setPassword('')
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === 'string') {
        setErrorMessage(error.data)
      } else {
        setErrorMessage('Unable to create account. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleClearSession() {
    setFreshUser(null)
    setSessionToken(null)
    window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10 text-slate-900">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Create your VibeCord account</h1>

        {activeUser ? (
          <div className="mt-4 space-y-4">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Signed in as <span className="font-semibold">{activeUser.loginName}</span>
            </p>
            <button
              type="button"
              onClick={handleClearSession}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear local session
            </button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleRegisterSubmit}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Login name</span>
              <input
                type="text"
                name="loginName"
                autoComplete="username"
                value={loginName}
                onChange={(event) => setLoginName(event.target.value)}
                required
                minLength={3}
                maxLength={24}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring"
              />
            </label>

            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

export default App
