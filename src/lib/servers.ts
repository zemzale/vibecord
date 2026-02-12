import { makeFunctionReference } from "convex/server";

export type ServerRecord = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  membershipRole: "owner" | "member";
};

export type ServerDeletionRecord = {
  ok: boolean;
  operationId: string;
  serverId?: string;
  status: "in_progress" | "completed";
  deletedMessages: number;
  deletedChannels: number;
  deletedMemberships: number;
  deletedServers: number;
  completedAt: number | null;
};

export const createServerMutation = makeFunctionReference<
  "mutation",
  {
    sessionToken: string;
    name: string;
  },
  ServerRecord
>("servers:createServer");

export const listMyServersQuery = makeFunctionReference<
  "query",
  {
    sessionToken: string;
  },
  Array<ServerRecord>
>("servers:listMyServers");

export const joinServerMutation = makeFunctionReference<
  "mutation",
  {
    sessionToken: string;
    serverId: string;
  },
  ServerRecord
>("servers:joinServer");

export const leaveServerMutation = makeFunctionReference<
  "mutation",
  {
    sessionToken: string;
    serverId: string;
  },
  {
    ok: boolean;
    serverId: string;
  }
>("servers:leaveServer");

export const deleteServerMutation = makeFunctionReference<
  "mutation",
  {
    sessionToken: string;
    serverId: string;
  },
  ServerDeletionRecord
>("servers:deleteServer");

export const getServerDeletionStatusQuery = makeFunctionReference<
  "query",
  {
    sessionToken: string;
    serverId: string;
  },
  ServerDeletionRecord | null
>("servers:getServerDeletionStatus");
