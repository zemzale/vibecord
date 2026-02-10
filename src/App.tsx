import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import {
  getSessionUserQuery,
  loginMutation,
  logoutMutation,
  registerMutation,
  SOCIAL_AUTH_PROVIDERS,
  SESSION_TOKEN_STORAGE_KEY,
  type SessionUser,
} from './lib/auth'
import {
  createServerMutation,
  joinServerMutation,
  leaveServerMutation,
  listMyServersQuery,
} from './lib/servers'

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
  const [serverName, setServerName] = useState('')
  const [joinServerId, setJoinServerId] = useState('')
  const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(null)
  const [joinServerErrorMessage, setJoinServerErrorMessage] = useState<string | null>(null)
  const [leaveServerErrorMessage, setLeaveServerErrorMessage] = useState<string | null>(null)
  const [isCreatingServer, setIsCreatingServer] = useState(false)
  const [isJoiningServer, setIsJoiningServer] = useState(false)
  const [leavingServerId, setLeavingServerId] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(readInitialSessionToken)
  const [freshUser, setFreshUser] = useState<SessionUser | null>(null)

  const register = useMutation(registerMutation)
  const login = useMutation(loginMutation)
  const logout = useMutation(logoutMutation)
  const createServer = useMutation(createServerMutation)
  const joinServer = useMutation(joinServerMutation)
  const leaveServer = useMutation(leaveServerMutation)
  const sessionUser = useQuery(
    getSessionUserQuery,
    sessionToken ? { sessionToken } : 'skip',
  )

  const activeUser = useMemo(
    () => (sessionUser === undefined ? freshUser : sessionUser),
    [freshUser, sessionUser],
  )
  const myServers = useQuery(
    listMyServersQuery,
    activeUser && sessionToken ? { sessionToken } : 'skip',
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

  async function handleCreateServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!sessionToken) {
      setServerErrorMessage('You must be logged in to create a server.')
      return
    }

    setServerErrorMessage(null)
    setIsCreatingServer(true)

    try {
      await createServer({
        sessionToken,
        name: serverName,
      })
      setServerName('')
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === 'string') {
        setServerErrorMessage(error.data)
      } else {
        setServerErrorMessage('Unable to create server right now. Please try again.')
      }
    } finally {
      setIsCreatingServer(false)
    }
  }

  async function handleJoinServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!sessionToken) {
      setJoinServerErrorMessage('You must be logged in to join a server.')
      return
    }

    setJoinServerErrorMessage(null)
    setLeaveServerErrorMessage(null)
    setIsJoiningServer(true)

    try {
      await joinServer({
        sessionToken,
        serverId: joinServerId.trim(),
      })
      setJoinServerId('')
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === 'string') {
        setJoinServerErrorMessage(error.data)
      } else {
        setJoinServerErrorMessage('Unable to join this server right now. Please try again.')
      }
    } finally {
      setIsJoiningServer(false)
    }
  }

  async function handleLeaveServer(serverId: string) {
    if (!sessionToken) {
      setLeaveServerErrorMessage('You must be logged in to leave a server.')
      return
    }

    setLeaveServerErrorMessage(null)
    setJoinServerErrorMessage(null)
    setLeavingServerId(serverId)

    try {
      await leaveServer({
        sessionToken,
        serverId,
      })
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === 'string') {
        setLeaveServerErrorMessage(error.data)
      } else {
        setLeaveServerErrorMessage('Unable to leave this server right now. Please try again.')
      }
    } finally {
      setLeavingServerId(null)
    }
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
            <form className="space-y-3" onSubmit={handleCreateServer}>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">New server name</span>
                <input
                  type="text"
                  name="serverName"
                  value={serverName}
                  onChange={(event) => setServerName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={64}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring"
                />
              </label>

              {serverErrorMessage ? <p className="text-sm text-red-600">{serverErrorMessage}</p> : null}

              <button
                type="submit"
                disabled={isCreatingServer}
                className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {isCreatingServer ? 'Creating server...' : 'Create server'}
              </button>
            </form>

            <form className="space-y-3" onSubmit={handleJoinServer}>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Join server by ID</span>
                <input
                  type="text"
                  name="joinServerId"
                  value={joinServerId}
                  onChange={(event) => setJoinServerId(event.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm outline-none ring-indigo-200 transition focus:ring"
                  placeholder="Enter server ID"
                />
              </label>

              {joinServerErrorMessage ? <p className="text-sm text-red-600">{joinServerErrorMessage}</p> : null}

              <button
                type="submit"
                disabled={isJoiningServer}
                className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                {isJoiningServer ? 'Joining server...' : 'Join server'}
              </button>
            </form>

            {leaveServerErrorMessage ? <p className="text-sm text-red-600">{leaveServerErrorMessage}</p> : null}

            <section aria-label="My servers" className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-700">My servers</h2>
              {myServers === undefined ? (
                <p className="text-sm text-slate-500">Loading servers...</p>
              ) : myServers.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                  No servers yet. Create your first server to get started.
                </p>
              ) : (
                <ul className="space-y-2">
                  {myServers.map((server) => (
                    <li
                      key={server.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{server.name}</p>
                          <p className="mt-1 text-xs text-slate-500">ID: {server.id}</p>
                        </div>
                        <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {server.membershipRole === 'owner' ? 'Owner' : 'Member'}
                        </span>
                      </div>
                      {server.membershipRole === 'member' ? (
                        <button
                          type="button"
                          onClick={() => void handleLeaveServer(server.id)}
                          disabled={leavingServerId === server.id}
                          className="mt-2 inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          {leavingServerId === server.id ? 'Leaving...' : 'Leave server'}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
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

            <div className="mt-4 space-y-2" aria-label="Social sign-in providers">
              {SOCIAL_AUTH_PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  disabled
                  className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500"
                >
                  {provider.label} (coming soon)
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              OAuth providers are planned. Use login name + password for this MVP.
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
