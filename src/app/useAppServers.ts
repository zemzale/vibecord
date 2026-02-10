import { useMemo } from "react";
import { useQuery } from "convex/react";
import { listMyServersQuery } from "../lib/servers";
import { listDirectMessageChannelsQuery } from "../lib/friends";
import { FRIENDS_SERVER_ID } from "./routing";
import type { SessionUser } from "../lib/auth";

type UseAppServersArgs = {
  activeUser: SessionUser;
  sessionToken: string;
};

export function useAppServers({ activeUser, sessionToken }: UseAppServersArgs) {
  const myServers = useQuery(listMyServersQuery, { sessionToken });
  const directMessageChannels = useQuery(listDirectMessageChannelsQuery, {
    sessionToken,
  });

  const appServers = useMemo(
    () => [
      {
        id: FRIENDS_SERVER_ID,
        name: "Friends",
        ownerId: activeUser.id,
        createdAt: Number.MAX_SAFE_INTEGER,
        membershipRole: "owner" as const,
      },
      ...(myServers ?? []),
    ],
    [activeUser.id, myServers],
  );

  return {
    appServers,
    myServers,
    directMessageChannels,
  };
}
