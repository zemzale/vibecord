import { makeFunctionReference } from 'convex/server'

export type SessionUser = {
  id: string
  loginName: string
}

export type SocialAuthProvider = 'google' | 'github'

export const SOCIAL_AUTH_PROVIDERS: ReadonlyArray<{ id: SocialAuthProvider; label: string }> = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'github', label: 'Continue with GitHub' },
]

export const registerMutation = makeFunctionReference<
  'mutation',
  {
    loginName: string
    password: string
  },
  {
    sessionToken: string
    user: SessionUser
  }
>('auth:register')

export const loginMutation = makeFunctionReference<
  'mutation',
  {
    loginName: string
    password: string
  },
  {
    sessionToken: string
    user: SessionUser
  }
>('auth:login')

export const logoutMutation = makeFunctionReference<
  'mutation',
  {
    sessionToken: string
  },
  {
    ok: boolean
  }
>('auth:logout')

export const getSessionUserQuery = makeFunctionReference<
  'query',
  {
    sessionToken: string
  },
  SessionUser | null
>('auth:getSessionUser')

export const SESSION_TOKEN_STORAGE_KEY = 'vibecord.sessionToken'
