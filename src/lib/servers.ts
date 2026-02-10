import { makeFunctionReference } from 'convex/server'

export type ServerRecord = {
  id: string
  name: string
  ownerId: string
  createdAt: number
  membershipRole: 'owner' | 'member'
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

export const joinServerMutation = makeFunctionReference<
  'mutation',
  {
    sessionToken: string
    serverId: string
  },
  ServerRecord
>('servers:joinServer')

export const leaveServerMutation = makeFunctionReference<
  'mutation',
  {
    sessionToken: string
    serverId: string
  },
  {
    ok: boolean
    serverId: string
  }
>('servers:leaveServer')
