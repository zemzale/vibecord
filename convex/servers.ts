import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type ServerMembershipRole = "owner" | "member";

const SERVER_DELETE_MESSAGE_BATCH_SIZE = 200;
const SERVER_DELETE_CHANNEL_BATCH_SIZE = 40;
const SERVER_DELETE_MEMBERSHIP_BATCH_SIZE = 200;
const SERVER_DELETE_CHANNEL_SCAN_BATCH_SIZE = 20;

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
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique();

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

    const existingMembership = await ctx.db
      .query("serverMemberships")
      .withIndex("by_server_id_user_id", (q) =>
        q.eq("serverId", args.serverId).eq("userId", userId),
      )
      .unique();

    if (existingMembership) {
      throw new ConvexError("You are already a member of this server.");
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

    const membership = await ctx.db
      .query("serverMemberships")
      .withIndex("by_server_id_user_id", (q) =>
        q.eq("serverId", args.serverId).eq("userId", userId),
      )
      .unique();

    if (!membership) {
      throw new ConvexError("You are not a member of this server.");
    }

    await ctx.db.delete(membership._id);

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

    const activeDeletion = await getActiveServerDeletionOperation(
      ctx,
      args.serverId,
    );
    if (activeDeletion) {
      return toServerDeletionResponse(activeDeletion);
    }

    const now = Date.now();
    const operationId = await ctx.db.insert("deletionOperations", {
      target: "server",
      requestedBy: userId,
      serverId: args.serverId,
      status: "in_progress",
      deletedMessages: 0,
      deletedChannels: 0,
      deletedMemberships: 0,
      deletedServers: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.servers.runServerDeletionBatch, {
      operationId,
    });

    return {
      ok: true,
      operationId,
      serverId: args.serverId,
      status: "in_progress" as const,
      deletedMessages: 0,
      deletedChannels: 0,
      deletedMemberships: 0,
      deletedServers: 0,
      completedAt: null,
    };
  },
});

export const runServerDeletionBatch = internalMutation({
  args: {
    operationId: v.id("deletionOperations"),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (
      !operation ||
      operation.status === "completed" ||
      operation.target !== "server"
    ) {
      return;
    }

    const now = Date.now();
    const serverId = operation.serverId;

    if (!serverId) {
      await ctx.db.patch(operation._id, {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });
      return;
    }

    const server = await ctx.db.get(serverId);
    if (!server) {
      await ctx.db.patch(operation._id, {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });
      return;
    }

    const deletedMessages = await deleteServerMessageBatch(ctx, serverId);
    if (deletedMessages > 0) {
      await ctx.db.patch(operation._id, {
        deletedMessages: operation.deletedMessages + deletedMessages,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.servers.runServerDeletionBatch, {
        operationId: operation._id,
      });
      return;
    }

    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server_id_created_at", (q) => q.eq("serverId", serverId))
      .take(SERVER_DELETE_CHANNEL_BATCH_SIZE);

    if (channels.length > 0) {
      await Promise.all(channels.map((channel) => ctx.db.delete(channel._id)));
      await ctx.db.patch(operation._id, {
        deletedChannels: operation.deletedChannels + channels.length,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.servers.runServerDeletionBatch, {
        operationId: operation._id,
      });
      return;
    }

    const memberships = await ctx.db
      .query("serverMemberships")
      .withIndex("by_server_id_user_id", (q) => q.eq("serverId", serverId))
      .take(SERVER_DELETE_MEMBERSHIP_BATCH_SIZE);

    if (memberships.length > 0) {
      await Promise.all(
        memberships.map((membership) => ctx.db.delete(membership._id)),
      );
      await ctx.db.patch(operation._id, {
        deletedMemberships: operation.deletedMemberships + memberships.length,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.servers.runServerDeletionBatch, {
        operationId: operation._id,
      });
      return;
    }

    await ctx.db.delete(serverId);
    await ctx.db.patch(operation._id, {
      status: "completed",
      deletedServers: operation.deletedServers + 1,
      completedAt: now,
      updatedAt: now,
    });
  },
});

export const getServerDeletionStatus = query({
  args: {
    sessionToken: v.string(),
    serverId: v.id("servers"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.sessionToken);
    const latestOperation = await getLatestServerDeletionOperation(
      ctx,
      args.serverId,
    );

    if (!latestOperation || latestOperation.requestedBy !== userId) {
      return null;
    }

    return toServerDeletionResponse(latestOperation);
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

async function deleteServerMessageBatch(
  ctx: MutationCtx,
  serverId: Id<"servers">,
) {
  const channels = await ctx.db
    .query("channels")
    .withIndex("by_server_id_created_at", (q) => q.eq("serverId", serverId))
    .take(SERVER_DELETE_CHANNEL_SCAN_BATCH_SIZE);

  let remaining = SERVER_DELETE_MESSAGE_BATCH_SIZE;
  let deletedMessages = 0;

  for (const channel of channels) {
    if (remaining <= 0) {
      break;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel_id_created_at", (q) =>
        q.eq("channelId", channel._id),
      )
      .take(remaining);

    if (messages.length === 0) {
      continue;
    }

    await Promise.all(messages.map((message) => ctx.db.delete(message._id)));
    deletedMessages += messages.length;
    remaining -= messages.length;
  }

  return deletedMessages;
}

async function getActiveServerDeletionOperation(
  ctx: MutationCtx,
  serverId: Id<"servers">,
) {
  const operations = await ctx.db
    .query("deletionOperations")
    .withIndex("by_server_id_status_updated_at", (q) =>
      q.eq("serverId", serverId).eq("status", "in_progress"),
    )
    .order("desc")
    .take(1);

  return operations[0] ?? null;
}

async function getLatestServerDeletionOperation(
  ctx: QueryCtx,
  serverId: Id<"servers">,
) {
  const operations = await ctx.db
    .query("deletionOperations")
    .withIndex("by_server_id_updated_at", (q) => q.eq("serverId", serverId))
    .order("desc")
    .take(1);

  return operations[0] ?? null;
}

function toServerDeletionResponse(operation: {
  _id: Id<"deletionOperations">;
  serverId?: Id<"servers">;
  status: "in_progress" | "completed";
  deletedMessages: number;
  deletedChannels: number;
  deletedMemberships: number;
  deletedServers: number;
  completedAt?: number;
}) {
  return {
    ok: true,
    operationId: operation._id,
    serverId: operation.serverId,
    status: operation.status,
    deletedMessages: operation.deletedMessages,
    deletedChannels: operation.deletedChannels,
    deletedMemberships: operation.deletedMemberships,
    deletedServers: operation.deletedServers,
    completedAt: operation.completedAt ?? null,
  };
}
