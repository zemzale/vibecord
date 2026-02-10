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
  loginName: string;
  since: number;
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
