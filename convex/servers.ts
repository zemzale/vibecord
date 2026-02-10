import { ConvexError, v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function getAuthenticatedUser(
  ctx: MutationCtx | QueryCtx,
  sessionToken: string,
): Promise<Id<'users'>> {
  const tokenHash = await sha256Hex(sessionToken)
  const now = Date.now()
  const session = await ctx.db
    .query('sessions')
    .withIndex('by_token_hash', (q) => q.eq('tokenHash', tokenHash))
    .unique()

  if (!session || session.expiresAt < now) {
    throw new ConvexError('You must be logged in to continue.')
  }

  const user = await ctx.db.get(session.userId)
  if (!user) {
    throw new ConvexError('You must be logged in to continue.')
  }

  return user._id
}

export const createServer = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const ownerId = await getAuthenticatedUser(ctx, args.sessionToken)
    const name = args.name.trim()

    if (name.length < 2 || name.length > 64) {
      throw new ConvexError('Server name must be between 2 and 64 characters.')
    }

    const createdAt = Date.now()
    const serverId = await ctx.db.insert('servers', {
      name,
      ownerId,
      createdAt,
    })

    return {
      id: serverId,
      name,
      ownerId,
      createdAt,
    }
  },
})

export const listMyServers = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.sessionToken)
    const servers = await ctx.db
      .query('servers')
      .withIndex('by_owner_id', (q) => q.eq('ownerId', userId))
      .collect()

    return servers
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((server) => ({
        id: server._id,
        name: server.name,
        ownerId: server.ownerId,
        createdAt: server.createdAt,
      }))
  },
})
