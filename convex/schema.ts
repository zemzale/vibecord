import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    loginName: v.string(),
    loginNameLower: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    createdAt: v.number(),
  }).index("by_login_name_lower", ["loginNameLower"]),
  sessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_user_id", ["userId"]),
  authAccounts: defineTable({
    userId: v.id("users"),
    provider: v.union(
      v.literal("credentials"),
      v.literal("google"),
      v.literal("github"),
    ),
    providerSubject: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.number(),
  })
    .index("by_provider_subject", ["provider", "providerSubject"])
    .index("by_user_id", ["userId"]),
  authRateLimits: defineTable({
    action: v.union(v.literal("login"), v.literal("register")),
    key: v.string(),
    windowStart: v.number(),
    attemptCount: v.number(),
    blockedUntil: v.number(),
    updatedAt: v.number(),
  })
    .index("by_action_key", ["action", "key"])
    .index("by_blocked_until", ["blockedUntil"]),
  friendRequests: defineTable({
    requesterId: v.id("users"),
    recipientId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
    ),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_recipient_status", ["recipientId", "status"])
    .index("by_requester_status", ["requesterId", "status"])
    .index("by_requester_recipient", ["requesterId", "recipientId"]),
  friendships: defineTable({
    userAId: v.id("users"),
    userBId: v.id("users"),
    pairKey: v.string(),
    createdAt: v.number(),
  })
    .index("by_pair_key", ["pairKey"])
    .index("by_user_a_id", ["userAId"])
    .index("by_user_b_id", ["userBId"]),
  directMessages: defineTable({
    friendshipId: v.id("friendships"),
    authorId: v.id("users"),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_friendship_id_created_at", ["friendshipId", "createdAt"]),
  servers: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_owner_id", ["ownerId"])
    .index("by_created_at", ["createdAt"]),
  serverMemberships: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_server_id_user_id", ["serverId", "userId"]),
  channels: defineTable({
    serverId: v.id("servers"),
    name: v.string(),
    nameLower: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_server_id_created_at", ["serverId", "createdAt"])
    .index("by_server_id_name_lower", ["serverId", "nameLower"]),
  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_channel_id_created_at", ["channelId", "createdAt"]),
});
