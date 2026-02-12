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

async function requireFriendshipParticipant(
  ctx: MutationCtx | QueryCtx,
  friendshipId: Id<"friendships">,
  userId: Id<"users">,
): Promise<{ friendshipId: Id<"friendships"> }> {
  const friendship = await ctx.db.get(friendshipId);
  if (!friendship) {
    throw new ConvexError("Direct message channel not found.");
  }

  if (friendship.userAId !== userId && friendship.userBId !== userId) {
    throw new ConvexError(
      "You do not have access to this direct message channel.",
    );
  }

  return {
    friendshipId: friendship._id,
  };
}

export const sendDirectMessage = mutation({
  args: {
    sessionToken: v.string(),
    friendshipId: v.id("friendships"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const authorId = await getAuthenticatedUser(ctx, args.sessionToken);
    const { friendshipId } = await requireFriendshipParticipant(
      ctx,
      args.friendshipId,
      authorId,
    );

    const content = args.content.trim();
    if (content.length < 1 || content.length > 2000) {
      throw new ConvexError(
        "Message content must be between 1 and 2000 characters.",
      );
    }

    const createdAt = Date.now();
    const messageId = await ctx.db.insert("directMessages", {
      friendshipId,
      authorId,
      content,
      createdAt,
    });

    const author = await ctx.db.get(authorId);

    return {
      id: messageId,
      friendshipId,
      authorId,
      authorLoginName: author?.loginName ?? "Unknown user",
      content,
      createdAt,
      canDelete: true,
    };
  },
});

export const listDirectMessages = query({
  args: {
    sessionToken: v.string(),
    friendshipId: v.id("friendships"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.sessionToken);
    const { friendshipId } = await requireFriendshipParticipant(
      ctx,
      args.friendshipId,
      userId,
    );

    const messages = await ctx.db
      .query("directMessages")
      .withIndex("by_friendship_id_created_at", (q) =>
        q.eq("friendshipId", friendshipId),
      )
      .collect();

    const authors = await Promise.all(
      messages.map((message) => ctx.db.get(message.authorId)),
    );

    return messages.map((message, index) => ({
      id: message._id,
      friendshipId: message.friendshipId,
      authorId: message.authorId,
      authorLoginName: authors[index]?.loginName ?? "Unknown user",
      content: message.content,
      createdAt: message.createdAt,
      canDelete: message.authorId === userId,
    }));
  },
});
