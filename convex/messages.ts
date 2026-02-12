import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

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

async function requireChannelAccess(
  ctx: MutationCtx | QueryCtx,
  channelId: Id<"channels">,
  userId: Id<"users">,
): Promise<{
  channelId: Id<"channels">;
  serverId: Id<"servers">;
  serverOwnerId: Id<"users">;
}> {
  const channel = await ctx.db.get(channelId);
  if (!channel) {
    throw new ConvexError("Channel not found.");
  }

  const server = await ctx.db.get(channel.serverId);
  if (!server) {
    throw new ConvexError("Server not found.");
  }

  if (server.ownerId !== userId) {
    const memberships = await ctx.db
      .query("serverMemberships")
      .withIndex("by_server_id_user_id", (q) =>
        q.eq("serverId", channel.serverId).eq("userId", userId),
      )
      .collect();

    if (memberships.length === 0) {
      throw new ConvexError("You are not a member of this channel.");
    }
  }

  return {
    channelId: channel._id,
    serverId: channel.serverId,
    serverOwnerId: server.ownerId,
  };
}

function canDeleteMessage(
  actorId: Id<"users">,
  serverOwnerId: Id<"users">,
  authorId: Id<"users">,
): boolean {
  return actorId === authorId || actorId === serverOwnerId;
}

export const sendMessage = mutation({
  args: {
    sessionToken: v.string(),
    channelId: v.id("channels"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const authorId = await getAuthenticatedUser(ctx, args.sessionToken);
    const { channelId } = await requireChannelAccess(
      ctx,
      args.channelId,
      authorId,
    );

    const content = args.content.trim();
    if (content.length < 1 || content.length > 2000) {
      throw new ConvexError(
        "Message content must be between 1 and 2000 characters.",
      );
    }

    const createdAt = Date.now();
    const messageId = await ctx.db.insert("messages", {
      channelId,
      authorId,
      content,
      createdAt,
    });

    const author = await ctx.db.get(authorId);
    return {
      id: messageId,
      channelId,
      authorId,
      authorLoginName: author?.loginName ?? "Unknown user",
      content,
      createdAt,
      canDelete: true,
    };
  },
});

export const listMessages = query({
  args: {
    sessionToken: v.string(),
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.sessionToken);
    const { channelId, serverOwnerId } = await requireChannelAccess(
      ctx,
      args.channelId,
      userId,
    );

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel_id_created_at", (q) =>
        q.eq("channelId", channelId),
      )
      .collect();

    const authors = await Promise.all(
      messages.map((message) => ctx.db.get(message.authorId)),
    );

    return messages.map((message, index) => ({
      id: message._id,
      channelId: message.channelId,
      authorId: message.authorId,
      authorLoginName: authors[index]?.loginName ?? "Unknown user",
      content: message.content,
      createdAt: message.createdAt,
      canDelete: canDeleteMessage(userId, serverOwnerId, message.authorId),
    }));
  },
});

export const deleteMessage = mutation({
  args: {
    sessionToken: v.string(),
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.sessionToken);
    const message = await ctx.db.get(args.messageId);

    if (!message) {
      throw new ConvexError("Message not found.");
    }

    const { serverOwnerId } = await requireChannelAccess(
      ctx,
      message.channelId,
      userId,
    );

    if (!canDeleteMessage(userId, serverOwnerId, message.authorId)) {
      throw new ConvexError(
        "You do not have permission to delete this message.",
      );
    }

    await ctx.db.delete(message._id);

    return {
      id: message._id,
    };
  },
});
