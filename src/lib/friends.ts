import { makeFunctionReference } from "convex/server";

export type IncomingFriendRequestRecord = {
  id: string;
  requesterId: string;
  requesterLoginName: string;
  createdAt: number;
};

export type OutgoingFriendRequestRecord = {
  id: string;
  recipientId: string;
  recipientLoginName: string;
  createdAt: number;
};

export type FriendRecord = {
  id: string;
  friendshipId: string;
  loginName: string;
  since: number;
};

export type DirectMessageChannelRecord = {
  id: string;
  friendId: string;
  friendLoginName: string;
  createdAt: number;
};

export type DirectMessageRecord = {
  id: string;
  friendshipId: string;
  authorId: string;
  authorLoginName: string;
  content: string;
  createdAt: number;
  canDelete: boolean;
};

export const sendFriendRequestMutation = makeFunctionReference<
  "mutation",
  {
    sessionToken: string;
    loginName: string;
  },
  {
    id: string;
    requesterId: string;
    requesterLoginName: string;
    recipientId: string;
    recipientLoginName: string;
    status: "pending";
  }
>("friends:sendFriendRequest");

export const respondToFriendRequestMutation = makeFunctionReference<
  "mutation",
  {
    sessionToken: string;
    requestId: string;
    action: "accept" | "decline";
  },
  {
    requestId: string;
    status: "accepted" | "declined";
  }
>("friends:respondToFriendRequest");

export const listFriendRequestsQuery = makeFunctionReference<
  "query",
  {
    sessionToken: string;
  },
  {
    incoming: Array<IncomingFriendRequestRecord>;
    outgoing: Array<OutgoingFriendRequestRecord>;
  }
>("friends:listFriendRequests");

export const listFriendsQuery = makeFunctionReference<
  "query",
  {
    sessionToken: string;
  },
  Array<FriendRecord>
>("friends:listFriends");

export const listDirectMessageChannelsQuery = makeFunctionReference<
  "query",
  {
    sessionToken: string;
  },
  Array<DirectMessageChannelRecord>
>("friends:listDirectMessageChannels");

export const sendDirectMessageMutation = makeFunctionReference<
  "mutation",
  {
    sessionToken: string;
    friendshipId: string;
    content: string;
  },
  DirectMessageRecord
>("directMessages:sendDirectMessage");

export const listDirectMessagesQuery = makeFunctionReference<
  "query",
  {
    sessionToken: string;
    friendshipId: string;
  },
  Array<DirectMessageRecord>
>("directMessages:listDirectMessages");
