import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

type ServerMembershipRole = "owner" | "member";

function selectMostRecentSession(
  rows: Doc<"sessions">[],
): Doc<"sessions"> | null {
  if (rows.length === 0) {
    return null;
  }

  return rows.reduce((latest, candidate) => {
    if (candidate.expiresAt !== latest.expiresAt) {
      return candidate.expiresAt > latest.expiresAt ? candidate : latest;
    }

    if (candidate.createdAt !== latest.createdAt) {
      return candidate.createdAt > latest.createdAt ? candidate : latest;
    }

    return candidate._creationTime > latest._creationTime ? candidate : latest;
  });
}

function isValidSessionToken(value: string): boolean {
  return value.length === 64 && /^[0-9a-f]+$/i.test(value);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function getAuthenticatedUser(
  ctx: MutationCtx | QueryCtx,
  sessionToken: string,
): Promise<Id<"users">> {
  if (!isValidSessionToken(sessionToken)) {
    throw new ConvexError("You must be logged in to continue.");
  }

  const tokenHash = await sha256Hex(sessionToken);
  const now = Date.now();
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .collect();
  const session = selectMostRecentSession(sessions);

  if (!session || session.expiresAt < now) {
    throw new ConvexError("You must be logged in to continue.");
  }

  const user = await ctx.db.get(session.userId);
  if (!user) {
    throw new ConvexError("You must be logged in to continue.");
  }

  return user._id;
}

export const createServer = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const ownerId = await getAuthenticatedUser(ctx, args.sessionToken);
    const name = args.name.trim();

    if (name.length < 2 || name.length > 64) {
      throw new ConvexError("Server name must be between 2 and 64 characters.");
    }

    const createdAt = Date.now();
    const serverId = await ctx.db.insert("servers", {
      name,
      ownerId,
      createdAt,
    });

    return {
      id: serverId,
      name,
      ownerId,
      createdAt,
    };
  },
});

export const joinServer = mutation({
  args: {
    sessionToken: v.string(),
    serverId: v.id("servers"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.sessionToken);
    const server = await ctx.db.get(args.serverId);

    if (!server) {
      throw new ConvexError("Server not found.");
    }

    if (server.ownerId === userId) {
      throw new ConvexError("You already belong to this server as the owner.");
    }

    const existingMemberships = await ctx.db
      .query("serverMemberships")
      .withIndex("by_server_id_user_id", (q) =>
        q.eq("serverId", args.serverId).eq("userId", userId),
      )
      .collect();

    if (existingMemberships.length > 0) {
      const canonicalMembership = existingMemberships.reduce(
        (earliest, candidate) =>
          candidate.joinedAt < earliest.joinedAt ? candidate : earliest,
      );
      const duplicateIds = existingMemberships
        .filter((membership) => membership._id !== canonicalMembership._id)
        .map((membership) => membership._id);

      for (const duplicateId of duplicateIds) {
        await ctx.db.delete(duplicateId);
      }

      return {
        id: server._id,
        name: server.name,
        ownerId: server.ownerId,
        createdAt: server.createdAt,
        membershipRole: "member" as ServerMembershipRole,
      };
    }

    await ctx.db.insert("serverMemberships", {
      serverId: args.serverId,
      userId,
      joinedAt: Date.now(),
    });

    return {
      id: server._id,
      name: server.name,
      ownerId: server.ownerId,
      createdAt: server.createdAt,
      membershipRole: "member" as ServerMembershipRole,
    };
  },
});

export const leaveServer = mutation({
  args: {
    sessionToken: v.string(),
    serverId: v.id("servers"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.sessionToken);
    const server = await ctx.db.get(args.serverId);

    if (!server) {
      throw new ConvexError("Server not found.");
    }

    if (server.ownerId === userId) {
      throw new ConvexError("Server owners cannot leave their own server.");
    }

    const memberships = await ctx.db
      .query("serverMemberships")
      .withIndex("by_server_id_user_id", (q) =>
        q.eq("serverId", args.serverId).eq("userId", userId),
      )
      .collect();

    if (memberships.length === 0) {
      throw new ConvexError("You are not a member of this server.");
    }

    await Promise.all(
      memberships.map((membership) => ctx.db.delete(membership._id)),
    );

    return {
      ok: true,
      serverId: args.serverId,
    };
  },
});

export const deleteServer = mutation({
  args: {
    sessionToken: v.string(),
    serverId: v.id("servers"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.sessionToken);
    const server = await ctx.db.get(args.serverId);

    if (!server) {
      throw new ConvexError("Server not found.");
    }

    if (server.ownerId !== userId) {
      throw new ConvexError("Only the server owner can delete this server.");
    }

    const memberships = await ctx.db
      .query("serverMemberships")
      .withIndex("by_server_id_user_id", (q) => q.eq("serverId", args.serverId))
      .collect();

    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server_id_created_at", (q) =>
        q.eq("serverId", args.serverId),
      )
      .collect();

    const messagesByChannel = await Promise.all(
      channels.map((channel) =>
        ctx.db
          .query("messages")
          .withIndex("by_channel_id_created_at", (q) =>
            q.eq("channelId", channel._id),
          )
          .collect(),
      ),
    );

    const messages = messagesByChannel.flat();

    await Promise.all(
      memberships.map((membership) => ctx.db.delete(membership._id)),
    );
    await Promise.all(messages.map((message) => ctx.db.delete(message._id)));
    await Promise.all(channels.map((channel) => ctx.db.delete(channel._id)));
    await ctx.db.delete(args.serverId);

    return {
      ok: true,
      serverId: args.serverId,
    };
  },
});

export const listMyServers = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.sessionToken);
    const ownedServers = await ctx.db
      .query("servers")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", userId))
      .collect();

    const memberships = await ctx.db
      .query("serverMemberships")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    const memberServerDocs = await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.serverId)),
    );

    const serversById = new Map<
      string,
      {
        id: Id<"servers">;
        name: string;
        ownerId: Id<"users">;
        createdAt: number;
        membershipRole: ServerMembershipRole;
      }
    >();

    for (const server of ownedServers) {
      serversById.set(server._id, {
        id: server._id,
        name: server.name,
        ownerId: server.ownerId,
        createdAt: server.createdAt,
        membershipRole: "owner",
      });
    }

    for (const server of memberServerDocs) {
      if (!server || serversById.has(server._id)) {
        continue;
      }

      serversById.set(server._id, {
        id: server._id,
        name: server.name,
        ownerId: server.ownerId,
        createdAt: server.createdAt,
        membershipRole: "member",
      });
    }

    return Array.from(serversById.values()).sort(
      (left, right) => right.createdAt - left.createdAt,
    );
  },
});
