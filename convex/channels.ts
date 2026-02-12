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

const CHANNEL_DELETE_MESSAGE_BATCH_SIZE = 200;

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

async function requireServerMembership(
  ctx: MutationCtx | QueryCtx,
  serverId: Id<"servers">,
  userId: Id<"users">,
): Promise<ServerMembershipRole> {
  const server = await ctx.db.get(serverId);
  if (!server) {
    throw new ConvexError("Server not found.");
  }

  if (server.ownerId === userId) {
    return "owner";
  }

  const membership = await ctx.db
    .query("serverMemberships")
    .withIndex("by_server_id_user_id", (q) =>
      q.eq("serverId", serverId).eq("userId", userId),
    )
    .unique();

  if (!membership) {
    throw new ConvexError("You are not a member of this server.");
  }

  return "member";
}

export const createChannel = mutation({
  args: {
    sessionToken: v.string(),
    serverId: v.id("servers"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.sessionToken);
    await requireServerMembership(ctx, args.serverId, userId);

    const name = args.name.trim();
    if (name.length < 1 || name.length > 64) {
      throw new ConvexError(
        "Channel name must be between 1 and 64 characters.",
      );
    }

    const nameLower = name.toLowerCase();
    const existingChannel = await ctx.db
      .query("channels")
      .withIndex("by_server_id_name_lower", (q) =>
        q.eq("serverId", args.serverId).eq("nameLower", nameLower),
      )
      .unique();

    if (existingChannel) {
      throw new ConvexError(
        "A channel with this name already exists in the selected server.",
      );
    }

    const createdAt = Date.now();
    const channelId = await ctx.db.insert("channels", {
      serverId: args.serverId,
      name,
      nameLower,
      createdBy: userId,
      createdAt,
    });

    return {
      id: channelId,
      serverId: args.serverId,
      name,
      createdBy: userId,
      createdAt,
      canDelete: true,
    };
  },
});

export const deleteChannel = mutation({
  args: {
    sessionToken: v.string(),
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.sessionToken);
    const channel = await ctx.db.get(args.channelId);

    if (!channel) {
      throw new ConvexError("Channel not found.");
    }

    const membershipRole = await requireServerMembership(
      ctx,
      channel.serverId,
      userId,
    );
    const canDelete =
      membershipRole === "owner" || channel.createdBy === userId;

    if (!canDelete) {
      throw new ConvexError(
        "Only the channel creator or server owner can delete this channel.",
      );
    }

    const activeDeletion = await getActiveChannelDeletionOperation(
      ctx,
      channel._id,
    );
    if (activeDeletion) {
      return toChannelDeletionResponse(activeDeletion);
    }

    const now = Date.now();
    const operationId = await ctx.db.insert("deletionOperations", {
      target: "channel",
      requestedBy: userId,
      serverId: channel.serverId,
      channelId: channel._id,
      status: "in_progress",
      deletedMessages: 0,
      deletedChannels: 0,
      deletedMemberships: 0,
      deletedServers: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.channels.runChannelDeletionBatch, {
      operationId,
    });

    return {
      ok: true,
      channelId: channel._id,
      serverId: channel.serverId,
      operationId,
      status: "in_progress" as const,
      deletedMessages: 0,
      deletedChannels: 0,
      completedAt: null,
    };
  },
});

export const runChannelDeletionBatch = internalMutation({
  args: {
    operationId: v.id("deletionOperations"),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (
      !operation ||
      operation.status === "completed" ||
      operation.target !== "channel"
    ) {
      return;
    }

    const now = Date.now();
    const channelId = operation.channelId;

    if (!channelId) {
      await ctx.db.patch(operation._id, {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });
      return;
    }

    const channel = await ctx.db.get(channelId);
    if (!channel) {
      await ctx.db.patch(operation._id, {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });
      return;
    }

    const messageBatch = await ctx.db
      .query("messages")
      .withIndex("by_channel_id_created_at", (q) =>
        q.eq("channelId", channelId),
      )
      .take(CHANNEL_DELETE_MESSAGE_BATCH_SIZE);

    if (messageBatch.length > 0) {
      await Promise.all(
        messageBatch.map((message) => ctx.db.delete(message._id)),
      );
      await ctx.db.patch(operation._id, {
        deletedMessages: operation.deletedMessages + messageBatch.length,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.channels.runChannelDeletionBatch,
        {
          operationId: operation._id,
        },
      );
      return;
    }

    await ctx.db.delete(channelId);
    await ctx.db.patch(operation._id, {
      status: "completed",
      deletedChannels: operation.deletedChannels + 1,
      completedAt: now,
      updatedAt: now,
    });
  },
});

export const getChannelDeletionStatus = query({
  args: {
    sessionToken: v.string(),
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.sessionToken);
    const latestOperation = await getLatestChannelDeletionOperation(
      ctx,
      args.channelId,
    );

    if (!latestOperation || latestOperation.requestedBy !== userId) {
      return null;
    }

    return toChannelDeletionResponse(latestOperation);
  },
});

export const listChannels = query({
  args: {
    sessionToken: v.string(),
    serverId: v.id("servers"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.sessionToken);
    const membershipRole = await requireServerMembership(
      ctx,
      args.serverId,
      userId,
    );
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server_id_created_at", (q) =>
        q.eq("serverId", args.serverId),
      )
      .collect();

    return channels.map((channel) => ({
      id: channel._id,
      serverId: channel.serverId,
      name: channel.name,
      createdBy: channel.createdBy,
      createdAt: channel.createdAt,
      canDelete: membershipRole === "owner" || channel.createdBy === userId,
    }));
  },
});

async function getActiveChannelDeletionOperation(
  ctx: MutationCtx,
  channelId: Id<"channels">,
) {
  const operations = await ctx.db
    .query("deletionOperations")
    .withIndex("by_channel_id_status_updated_at", (q) =>
      q.eq("channelId", channelId).eq("status", "in_progress"),
    )
    .order("desc")
    .take(1);

  return operations[0] ?? null;
}

async function getLatestChannelDeletionOperation(
  ctx: QueryCtx,
  channelId: Id<"channels">,
) {
  const operations = await ctx.db
    .query("deletionOperations")
    .withIndex("by_channel_id_updated_at", (q) => q.eq("channelId", channelId))
    .order("desc")
    .take(1);

  return operations[0] ?? null;
}

function toChannelDeletionResponse(operation: {
  _id: Id<"deletionOperations">;
  channelId?: Id<"channels">;
  serverId?: Id<"servers">;
  status: "in_progress" | "completed";
  deletedMessages: number;
  deletedChannels: number;
  completedAt?: number;
}) {
  return {
    ok: true,
    operationId: operation._id,
    channelId: operation.channelId,
    serverId: operation.serverId,
    status: operation.status,
    deletedMessages: operation.deletedMessages,
    deletedChannels: operation.deletedChannels,
    completedAt: operation.completedAt ?? null,
  };
}
