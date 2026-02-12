import { makeFunctionReference } from "convex/server";

export type ChannelRecord = {
  id: string;
  serverId: string;
  name: string;
  createdBy: string;
  createdAt: number;
  canDelete: boolean;
};

export type ChannelDeletionRecord = {
  ok: boolean;
  operationId: string;
  channelId?: string;
  serverId?: string;
  status: "in_progress" | "completed";
  deletedMessages: number;
  deletedChannels: number;
  completedAt: number | null;
};

export const createChannelMutation = makeFunctionReference<
  "mutation",
  {
    sessionToken: string;
    serverId: string;
    name: string;
  },
  ChannelRecord
>("channels:createChannel");

export const deleteChannelMutation = makeFunctionReference<
  "mutation",
  {
    sessionToken: string;
    channelId: string;
  },
  ChannelDeletionRecord
>("channels:deleteChannel");

export const getChannelDeletionStatusQuery = makeFunctionReference<
  "query",
  {
    sessionToken: string;
    channelId: string;
  },
  ChannelDeletionRecord | null
>("channels:getChannelDeletionStatus");

export const listChannelsQuery = makeFunctionReference<
  "query",
  {
    sessionToken: string;
    serverId: string;
  },
  Array<ChannelRecord>
>("channels:listChannels");
