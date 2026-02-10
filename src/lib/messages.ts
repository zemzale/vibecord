import { makeFunctionReference } from 'convex/server'

export type MessageRecord = {
  id: string
  channelId: string
  authorId: string
  authorLoginName: string
  content: string
  createdAt: number
}

export const sendMessageMutation = makeFunctionReference<
  'mutation',
  {
    sessionToken: string
    channelId: string
    content: string
  },
  MessageRecord
>('messages:sendMessage')

export const listMessagesQuery = makeFunctionReference<
  'query',
  {
    sessionToken: string
    channelId: string
  },
  Array<MessageRecord>
>('messages:listMessages')
