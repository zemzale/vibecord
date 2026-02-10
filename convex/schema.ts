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
})
