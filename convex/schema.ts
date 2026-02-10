import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    loginName: v.string(),
    loginNameLower: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    createdAt: v.number(),
  }).index('by_login_name_lower', ['loginNameLower']),
  sessions: defineTable({
    userId: v.id('users'),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index('by_token_hash', ['tokenHash'])
    .index('by_user_id', ['userId']),
  authAccounts: defineTable({
    userId: v.id('users'),
    provider: v.union(v.literal('credentials'), v.literal('google'), v.literal('github')),
    providerSubject: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.number(),
  })
    .index('by_provider_subject', ['provider', 'providerSubject'])
    .index('by_user_id', ['userId']),
  servers: defineTable({
    name: v.string(),
    ownerId: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_owner_id', ['ownerId'])
    .index('by_created_at', ['createdAt']),
  serverMemberships: defineTable({
    serverId: v.id('servers'),
    userId: v.id('users'),
    joinedAt: v.number(),
  })
    .index('by_user_id', ['userId'])
    .index('by_server_id_user_id', ['serverId', 'userId']),
})
