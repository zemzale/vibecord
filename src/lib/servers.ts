import { makeFunctionReference } from 'convex/server'

export type ServerRecord = {
  id: string
  name: string
  ownerId: string
  createdAt: number
}

export const createServerMutation = makeFunctionReference<
  'mutation',
  {
    sessionToken: string
    name: string
  },
  ServerRecord
>('servers:createServer')

export const listMyServersQuery = makeFunctionReference<
  'query',
  {
    sessionToken: string
  },
  Array<ServerRecord>
>('servers:listMyServers')
