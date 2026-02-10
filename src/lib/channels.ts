import { makeFunctionReference } from 'convex/server'

export type ChannelRecord = {
  id: string
  serverId: string
  name: string
  createdBy: string
  createdAt: number
  canDelete: boolean
}

export const createChannelMutation = makeFunctionReference<
  'mutation',
  {
    sessionToken: string
    serverId: string
    name: string
  },
  ChannelRecord
>('channels:createChannel')

export const deleteChannelMutation = makeFunctionReference<
  'mutation',
  {
    sessionToken: string
    channelId: string
  },
  {
    ok: boolean
    channelId: string
    serverId: string
  }
>('channels:deleteChannel')

export const listChannelsQuery = makeFunctionReference<
  'query',
  {
    sessionToken: string
    serverId: string
  },
  Array<ChannelRecord>
>('channels:listChannels')
