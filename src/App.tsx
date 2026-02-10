import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import {
  getSessionUserQuery,
  loginMutation,
  logoutMutation,
  registerMutation,
  SESSION_TOKEN_STORAGE_KEY,
  type SessionUser,
} from './lib/auth'

type AuthRoute = 'login' | 'register'

function readInitialSessionToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const token = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY)
  return token && token.length > 0 ? token : null
}

function App() {
  const [authRoute, setAuthRoute] = useState<AuthRoute>('login')
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(readInitialSessionToken)
  const [freshUser, setFreshUser] = useState<SessionUser | null>(null)

  const register = useMutation(registerMutation)
  const login = useMutation(loginMutation)
  const logout = useMutation(logoutMutation)
  const sessionUser = useQuery(
    getSessionUserQuery,
    sessionToken ? { sessionToken } : 'skip',
  )

  const activeUser = useMemo(
    () => (sessionUser === undefined ? freshUser : sessionUser),
    [freshUser, sessionUser],
  )

  useEffect(() => {
    if (!sessionToken || sessionUser !== null) {
      return
    }

    setFreshUser(null)
    setSessionToken(null)
    window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY)
    setAuthRoute('login')
  }, [sessionToken, sessionUser])

  function persistSession(nextSessionToken: string) {
    setSessionToken(nextSessionToken)
    window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, nextSessionToken)
  }

  function clearLocalSession() {
    setFreshUser(null)
    setSessionToken(null)
    window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY)
    setAuthRoute('login')
  }

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
      persistSession(result.sessionToken)
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

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const result = await login({
        loginName,
        password,
      })

      setFreshUser(result.user)
      persistSession(result.sessionToken)
      setLoginName('')
      setPassword('')
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === 'string') {
        setErrorMessage(error.data)
      } else {
        setErrorMessage('Invalid login credentials.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLogout() {
    const activeToken = sessionToken
    if (activeToken) {
      try {
        await logout({ sessionToken: activeToken })
      } catch {}
    }

    clearLocalSession()
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10 text-slate-900">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">VibeCord</h1>

        {activeUser ? (
          <div className="mt-4 space-y-4">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Signed in as <span className="font-semibold">{activeUser.loginName}</span>
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              {authRoute === 'login' ? 'Login to access your account.' : 'Create your account to continue.'}
            </p>

            <form
              className="mt-6 space-y-4"
              onSubmit={authRoute === 'login' ? handleLoginSubmit : handleRegisterSubmit}
            >
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
                  autoComplete={authRoute === 'login' ? 'current-password' : 'new-password'}
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
                {isSubmitting
                  ? authRoute === 'login'
                    ? 'Logging in...'
                    : 'Creating account...'
                  : authRoute === 'login'
                    ? 'Login'
                    : 'Create account'}
              </button>
            </form>

            <p className="mt-4 text-sm text-slate-600">
              {authRoute === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthRoute(authRoute === 'login' ? 'register' : 'login')
                  setErrorMessage(null)
                }}
                className="font-medium text-slate-900 underline-offset-2 hover:underline"
              >
                {authRoute === 'login' ? 'Register' : 'Login'}
              </button>
            </p>
          </>
        )}
      </section>
    </main>
  )
}

export default App
