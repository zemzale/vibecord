import { useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { listChannelsQuery } from "../lib/channels";
import { FRIENDS_SERVER_ID, createAppPath, type AppRoute } from "./routing";
import { useAppServers } from "./useAppServers";
import type { SessionUser } from "../lib/auth";

type ChannelsPanelProps = {
  activeUser: SessionUser;
  sessionToken: string;
  route: Extract<AppRoute, { kind: "app"; section: "chat" }>;
  navigate: (path: string, options?: { replace?: boolean }) => void;
};

export function ChannelsPanel({
  activeUser,
  sessionToken,
  route,
  navigate,
}: ChannelsPanelProps) {
  const { appServers, directMessageChannels } = useAppServers({
    activeUser,
    sessionToken,
  });

  const selectedServerId = route.serverId;
  const selectedChannelId = route.channelId;
  const isFriendsServerSelected = selectedServerId === FRIENDS_SERVER_ID;
  const channels = useQuery(
    listChannelsQuery,
    selectedServerId && !isFriendsServerSelected
      ? { sessionToken, serverId: selectedServerId }
      : "skip",
  );

  const selectedServer = useMemo(
    () => appServers.find((server) => server.id === selectedServerId) ?? null,
    [appServers, selectedServerId],
  );

  useEffect(() => {
    if (!route.serverId) {
      return;
    }

    if (route.serverId === FRIENDS_SERVER_ID) {
      if (!directMessageChannels) {
        return;
      }

      if (directMessageChannels.length === 0) {
        if (route.channelId) {
          navigate(createAppPath(FRIENDS_SERVER_ID, null), { replace: true });
        }
        return;
      }

      const hasSelection = route.channelId
        ? directMessageChannels.some(
            (channel) => channel.id === route.channelId,
          )
        : false;

      if (!hasSelection) {
        navigate(
          createAppPath(FRIENDS_SERVER_ID, directMessageChannels[0].id),
          {
            replace: true,
          },
        );
      }

      return;
    }

    if (!channels) {
      return;
    }

    if (channels.length === 0) {
      if (route.channelId) {
        navigate(createAppPath(route.serverId, null), { replace: true });
      }
      return;
    }

    const hasSelection = route.channelId
      ? channels.some((channel) => channel.id === route.channelId)
      : false;
    if (!hasSelection) {
      navigate(createAppPath(route.serverId, channels[0].id), {
        replace: true,
      });
    }
  }, [
    channels,
    directMessageChannels,
    navigate,
    route.channelId,
    route.serverId,
  ]);

  return (
    <section
      aria-label="Channels"
      className="border-b border-slate-800 bg-slate-950 p-4 lg:border-r lg:border-b-0"
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
        Channels
      </h2>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
          Selected server
        </span>
        <select
          value={selectedServerId ?? ""}
          onChange={(event) => {
            navigate(createAppPath(event.target.value || null, null));
          }}
          disabled={appServers.length === 0}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950"
        >
          {appServers.length > 0 ? (
            appServers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name}
              </option>
            ))
          ) : (
            <option value="">No servers available</option>
          )}
        </select>
      </label>

      {selectedServer ? (
        <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
          <p className="font-semibold text-slate-100">{selectedServer.name}</p>
          {selectedServer.id !== FRIENDS_SERVER_ID ? (
            <p className="mt-1 uppercase tracking-wide text-slate-400">
              Role:{" "}
              {selectedServer.membershipRole === "owner" ? "Owner" : "Member"}
            </p>
          ) : (
            <p className="mt-1 uppercase tracking-wide text-slate-400">
              Role: DM
            </p>
          )}
        </div>
      ) : null}

      {!selectedServerId ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-400">
          Select a server to view its channels.
        </p>
      ) : isFriendsServerSelected ? (
        directMessageChannels === undefined ? (
          <p className="mt-3 text-sm text-slate-400">Loading DMs...</p>
        ) : directMessageChannels.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-400">
            Accept a friend request to start a DM channel.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {directMessageChannels.map((channel) => {
              const isSelected = selectedChannelId === channel.id;

              return (
                <li
                  key={channel.id}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    isSelected
                      ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
                      : "border-slate-700 bg-slate-900 text-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      navigate(createAppPath(FRIENDS_SERVER_ID, channel.id));
                    }}
                    className="min-w-0 w-full text-left"
                  >
                    <p className="truncate font-medium">
                      @ {channel.friendLoginName}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : channels === undefined ? (
        <p className="mt-3 text-sm text-slate-400">Loading channels...</p>
      ) : channels.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-400">
          No channels in this server yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {channels.map((channel) => {
            const isSelected = selectedChannelId === channel.id;

            return (
              <li
                key={channel.id}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  isSelected
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
                    : "border-slate-700 bg-slate-900 text-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    navigate(createAppPath(selectedServerId, channel.id));
                  }}
                  className="min-w-0 w-full text-left"
                >
                  <p className="truncate font-medium"># {channel.name}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
