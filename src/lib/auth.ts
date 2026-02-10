import { makeFunctionReference } from 'convex/server'

export type SessionUser = {
  id: string
  loginName: string
}

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

export const getSessionUserQuery = makeFunctionReference<
  'query',
  {
    sessionToken: string
  },
  SessionUser | null
>('auth:getSessionUser')

export const SESSION_TOKEN_STORAGE_KEY = 'vibecord.sessionToken'
