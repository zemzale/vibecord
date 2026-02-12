import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

type FriendRequestStatus = "pending" | "accepted" | "declined";

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

function selectMostRecentUser(rows: Doc<"users">[]): Doc<"users"> | null {
  if (rows.length === 0) {
    return null;
  }

  return rows.reduce((latest, candidate) => {
    if (candidate.createdAt !== latest.createdAt) {
      return candidate.createdAt > latest.createdAt ? candidate : latest;
    }

    return candidate._creationTime > latest._creationTime ? candidate : latest;
  });
}

async function upsertFriendship(
  ctx: MutationCtx,
  requesterId: Id<"users">,
  recipientId: Id<"users">,
  createdAt: number,
): Promise<void> {
  const pairKey = pairKeyForUsers(requesterId, recipientId);
  const existingRows = await ctx.db
    .query("friendships")
    .withIndex("by_pair_key", (q) => q.eq("pairKey", pairKey))
    .collect();

  if (existingRows.length === 0) {
    await ctx.db.insert("friendships", {
      userAId: requesterId,
      userBId: recipientId,
      pairKey,
      createdAt,
    });
    return;
  }

  const canonical = existingRows.reduce((earliest, candidate) =>
    candidate.createdAt < earliest.createdAt ? candidate : earliest,
  );
  const duplicateIds = existingRows
    .filter((row) => row._id !== canonical._id)
    .map((row) => row._id);

  for (const duplicateId of duplicateIds) {
    await ctx.db.delete(duplicateId);
  }
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
): Promise<{ id: Id<"users">; loginName: string; loginNameLower: string }> {
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

  return {
    id: user._id,
    loginName: user.loginName,
    loginNameLower: user.loginNameLower,
  };
}

function pairKeyForUsers(left: Id<"users">, right: Id<"users">): string {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

async function ensureNoExistingFriendship(
  ctx: MutationCtx | QueryCtx,
  requesterId: Id<"users">,
  recipientId: Id<"users">,
): Promise<void> {
  const pairKey = pairKeyForUsers(requesterId, recipientId);
  const friendships = await ctx.db
    .query("friendships")
    .withIndex("by_pair_key", (q) => q.eq("pairKey", pairKey))
    .collect();

  if (friendships.length > 0) {
    throw new ConvexError("You are already friends with this user.");
  }
}

async function findPendingRequestBetween(
  ctx: MutationCtx | QueryCtx,
  leftUserId: Id<"users">,
  rightUserId: Id<"users">,
) {
  const leftToRight = await ctx.db
    .query("friendRequests")
    .withIndex("by_requester_recipient", (q) =>
      q.eq("requesterId", leftUserId).eq("recipientId", rightUserId),
    )
    .collect();

  const rightToLeft = await ctx.db
    .query("friendRequests")
    .withIndex("by_requester_recipient", (q) =>
      q.eq("requesterId", rightUserId).eq("recipientId", leftUserId),
    )
    .collect();

  return (
    [...leftToRight, ...rightToLeft].find(
      (request) => request.status === "pending",
    ) ?? null
  );
}

function normalizeLoginName(loginName: string): {
  display: string;
  normalized: string;
} {
  const display = loginName.trim();
  return { display, normalized: display.toLowerCase() };
}

export const sendFriendRequest = mutation({
  args: {
    sessionToken: v.string(),
    loginName: v.string(),
  },
  handler: async (ctx, args) => {
    const requester = await getAuthenticatedUser(ctx, args.sessionToken);
    const { display, normalized } = normalizeLoginName(args.loginName);

    if (display.length < 3 || display.length > 24) {
      throw new ConvexError("Login name must be between 3 and 24 characters.");
    }

    if (!/^[a-zA-Z0-9_]+$/.test(display)) {
      throw new ConvexError(
        "Login name may only contain letters, numbers, and underscore.",
      );
    }

    const recipientRows = await ctx.db
      .query("users")
      .withIndex("by_login_name_lower", (q) =>
        q.eq("loginNameLower", normalized),
      )
      .collect();
    const recipient = selectMostRecentUser(recipientRows);

    if (!recipient) {
      throw new ConvexError("User not found.");
    }

    if (recipient._id === requester.id) {
      throw new ConvexError("You cannot send a friend request to yourself.");
    }

    await ensureNoExistingFriendship(ctx, requester.id, recipient._id);

    const pendingRequest = await findPendingRequestBetween(
      ctx,
      requester.id,
      recipient._id,
    );
    if (pendingRequest) {
      throw new ConvexError(
        "A pending friend request already exists between you and this user.",
      );
    }

    const requestId = await ctx.db.insert("friendRequests", {
      requesterId: requester.id,
      recipientId: recipient._id,
      status: "pending",
      createdAt: Date.now(),
    });

    return {
      id: requestId,
      requesterId: requester.id,
      requesterLoginName: requester.loginName,
      recipientId: recipient._id,
      recipientLoginName: recipient.loginName,
      status: "pending" as FriendRequestStatus,
    };
  },
});

export const respondToFriendRequest = mutation({
  args: {
    sessionToken: v.string(),
    requestId: v.id("friendRequests"),
    action: v.union(v.literal("accept"), v.literal("decline")),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedUser(ctx, args.sessionToken);
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new ConvexError("Friend request not found.");
    }

    if (request.recipientId !== actor.id) {
      throw new ConvexError(
        "Only the request recipient can respond to this friend request.",
      );
    }

    if (request.status !== "pending") {
      throw new ConvexError("This friend request has already been handled.");
    }

    const nextStatus: FriendRequestStatus =
      args.action === "accept" ? "accepted" : "declined";
    const respondedAt = Date.now();

    if (nextStatus === "accepted") {
      await upsertFriendship(
        ctx,
        request.requesterId,
        request.recipientId,
        respondedAt,
      );
    }

    await ctx.db.patch(request._id, {
      status: nextStatus,
      respondedAt,
    });

    return {
      requestId: request._id,
      status: nextStatus,
    };
  },
});

export const listFriendRequests = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedUser(ctx, args.sessionToken);

    const incoming = await ctx.db
      .query("friendRequests")
      .withIndex("by_recipient_status", (q) =>
        q.eq("recipientId", actor.id).eq("status", "pending"),
      )
      .collect();

    const outgoing = await ctx.db
      .query("friendRequests")
      .withIndex("by_requester_status", (q) =>
        q.eq("requesterId", actor.id).eq("status", "pending"),
      )
      .collect();

    const incomingUsers = await Promise.all(
      incoming.map((request) => ctx.db.get(request.requesterId)),
    );
    const outgoingUsers = await Promise.all(
      outgoing.map((request) => ctx.db.get(request.recipientId)),
    );

    return {
      incoming: incoming
        .map((request, index) => {
          const user = incomingUsers[index];
          if (!user) {
            return null;
          }

          return {
            id: request._id,
            requesterId: request.requesterId,
            requesterLoginName: user.loginName,
            createdAt: request.createdAt,
          };
        })
        .filter(
          (request): request is NonNullable<typeof request> => request !== null,
        )
        .sort((left, right) => right.createdAt - left.createdAt),
      outgoing: outgoing
        .map((request, index) => {
          const user = outgoingUsers[index];
          if (!user) {
            return null;
          }

          return {
            id: request._id,
            recipientId: request.recipientId,
            recipientLoginName: user.loginName,
            createdAt: request.createdAt,
          };
        })
        .filter(
          (request): request is NonNullable<typeof request> => request !== null,
        )
        .sort((left, right) => right.createdAt - left.createdAt),
    };
  },
});

export const listFriends = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedUser(ctx, args.sessionToken);
    const asUserA = await ctx.db
      .query("friendships")
      .withIndex("by_user_a_id", (q) => q.eq("userAId", actor.id))
      .collect();
    const asUserB = await ctx.db
      .query("friendships")
      .withIndex("by_user_b_id", (q) => q.eq("userBId", actor.id))
      .collect();

    const friendships = [...asUserA, ...asUserB];
    const friendIds = friendships.map((friendship) =>
      friendship.userAId === actor.id ? friendship.userBId : friendship.userAId,
    );

    const friendUsers = await Promise.all(
      friendIds.map((friendId) => ctx.db.get(friendId)),
    );

    return friendUsers
      .map((friend, index) => {
        if (!friend) {
          return null;
        }

        return {
          id: friend._id,
          friendshipId: friendships[index]._id,
          loginName: friend.loginName,
          since: friendships[index].createdAt,
        };
      })
      .filter((friend): friend is NonNullable<typeof friend> => friend !== null)
      .sort((left, right) => left.loginName.localeCompare(right.loginName));
  },
});

export const listDirectMessageChannels = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedUser(ctx, args.sessionToken);
    const asUserA = await ctx.db
      .query("friendships")
      .withIndex("by_user_a_id", (q) => q.eq("userAId", actor.id))
      .collect();
    const asUserB = await ctx.db
      .query("friendships")
      .withIndex("by_user_b_id", (q) => q.eq("userBId", actor.id))
      .collect();

    const friendships = [...asUserA, ...asUserB];
    const friendIds = friendships.map((friendship) =>
      friendship.userAId === actor.id ? friendship.userBId : friendship.userAId,
    );

    const friendUsers = await Promise.all(
      friendIds.map((friendId) => ctx.db.get(friendId)),
    );

    return friendUsers
      .map((friend, index) => {
        if (!friend) {
          return null;
        }

        return {
          id: friendships[index]._id,
          friendId: friend._id,
          friendLoginName: friend.loginName,
          createdAt: friendships[index].createdAt,
        };
      })
      .filter(
        (channel): channel is NonNullable<typeof channel> => channel !== null,
      )
      .sort((left, right) =>
        left.friendLoginName.localeCompare(right.friendLoginName),
      );
  },
});
