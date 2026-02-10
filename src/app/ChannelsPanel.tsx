import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createChannelMutation,
  deleteChannelMutation,
  listChannelsQuery,
} from "../lib/channels";
import { deleteServerMutation, leaveServerMutation } from "../lib/servers";
import { FRIENDS_SERVER_ID, createAppPath, type AppRoute } from "./routing";
import { useAppServers } from "./useAppServers";
import type { SessionUser } from "../lib/auth";

type ChannelsPanelProps = {
  activeUser: SessionUser;
  sessionToken: string;
  route: Extract<AppRoute, { kind: "app" }>;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  onChannelChange: () => void;
};

export function ChannelsPanel({
  activeUser,
  sessionToken,
  route,
  navigate,
  onChannelChange,
}: ChannelsPanelProps) {
  const [channelName, setChannelName] = useState("");
  const [channelErrorMessage, setChannelErrorMessage] = useState<string | null>(
    null,
  );
  const [leaveServerErrorMessage, setLeaveServerErrorMessage] = useState<
    string | null
  >(null);
  const [deleteServerErrorMessage, setDeleteServerErrorMessage] = useState<
    string | null
  >(null);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [leavingServerId, setLeavingServerId] = useState<string | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(
    null,
  );

  const createChannel = useMutation(createChannelMutation);
  const deleteChannel = useMutation(deleteChannelMutation);
  const leaveServer = useMutation(leaveServerMutation);
  const deleteServer = useMutation(deleteServerMutation);

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

  async function handleCreateChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedServerId) {
      setChannelErrorMessage("Select a server before creating a channel.");
      return;
    }

    setChannelErrorMessage(null);
    setIsCreatingChannel(true);

    try {
      const channel = await createChannel({
        sessionToken,
        serverId: selectedServerId,
        name: channelName,
      });
      setChannelName("");
      onChannelChange();
      navigate(createAppPath(selectedServerId, channel.id));
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setChannelErrorMessage(error.data);
      } else {
        setChannelErrorMessage(
          "Unable to create this channel right now. Please try again.",
        );
      }
    } finally {
      setIsCreatingChannel(false);
    }
  }

  async function handleDeleteChannel(channelId: string) {
    setChannelErrorMessage(null);
    setDeletingChannelId(channelId);

    try {
      await deleteChannel({ sessionToken, channelId });
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setChannelErrorMessage(error.data);
      } else {
        setChannelErrorMessage(
          "Unable to delete this channel right now. Please try again.",
        );
      }
    } finally {
      setDeletingChannelId(null);
    }
  }

  async function handleLeaveServer(serverId: string) {
    setLeaveServerErrorMessage(null);
    setDeleteServerErrorMessage(null);
    setLeavingServerId(serverId);

    try {
      await leaveServer({ sessionToken, serverId });
      if (selectedServerId === serverId) {
        navigate(createAppPath(FRIENDS_SERVER_ID, null));
      }
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setLeaveServerErrorMessage(error.data);
      } else {
        setLeaveServerErrorMessage(
          "Unable to leave this server right now. Please try again.",
        );
      }
    } finally {
      setLeavingServerId(null);
    }
  }

  async function handleDeleteServer(serverId: string) {
    setDeleteServerErrorMessage(null);
    setLeaveServerErrorMessage(null);
    setDeletingServerId(serverId);

    try {
      await deleteServer({ sessionToken, serverId });
      if (selectedServerId === serverId) {
        navigate(createAppPath(FRIENDS_SERVER_ID, null));
      }
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setDeleteServerErrorMessage(error.data);
      } else {
        setDeleteServerErrorMessage(
          "Unable to delete this server right now. Please try again.",
        );
      }
    } finally {
      setDeletingServerId(null);
    }
  }

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
            setChannelErrorMessage(null);
            onChannelChange();
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
            <>
              <p className="mt-1 font-mono text-[11px] text-slate-400">
                ID: {selectedServer.id}
              </p>
              <p className="mt-1 uppercase tracking-wide text-slate-400">
                Role:{" "}
                {selectedServer.membershipRole === "owner" ? "Owner" : "Member"}
              </p>
            </>
          ) : (
            <p className="mt-1 uppercase tracking-wide text-slate-400">
              Role: DM
            </p>
          )}

          {selectedServer.id !== FRIENDS_SERVER_ID &&
          selectedServer.membershipRole === "member" ? (
            <button
              type="button"
              onClick={() => void handleLeaveServer(selectedServer.id)}
              disabled={leavingServerId === selectedServer.id}
              className="mt-2 inline-flex items-center rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {leavingServerId === selectedServer.id
                ? "Leaving..."
                : "Leave server"}
            </button>
          ) : selectedServer.id !== FRIENDS_SERVER_ID &&
            selectedServer.membershipRole === "owner" ? (
            <button
              type="button"
              onClick={() => void handleDeleteServer(selectedServer.id)}
              disabled={deletingServerId === selectedServer.id}
              className="mt-2 inline-flex items-center rounded-full border border-rose-300/40 bg-rose-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingServerId === selectedServer.id
                ? "Deleting..."
                : "Delete server"}
            </button>
          ) : null}
        </div>
      ) : null}

      {leaveServerErrorMessage ? (
        <p className="mt-2 text-sm text-rose-300">{leaveServerErrorMessage}</p>
      ) : null}
      {deleteServerErrorMessage ? (
        <p className="mt-2 text-sm text-rose-300">{deleteServerErrorMessage}</p>
      ) : null}

      <form className="mt-4 space-y-2" onSubmit={handleCreateChannel}>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Create channel
          </span>
          <input
            type="text"
            name="channelName"
            value={channelName}
            onChange={(event) => setChannelName(event.target.value)}
            required
            minLength={1}
            maxLength={64}
            disabled={!selectedServerId || isFriendsServerSelected}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950"
            placeholder={
              isFriendsServerSelected
                ? "Direct message channels are generated automatically"
                : selectedServer
                  ? `Create in ${selectedServer.name}`
                  : "Select a server first"
            }
          />
        </label>

        <button
          type="submit"
          disabled={
            isCreatingChannel || !selectedServerId || isFriendsServerSelected
          }
          className="inline-flex w-full items-center justify-center rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCreatingChannel ? "Creating channel..." : "Create channel"}
        </button>
      </form>

      {channelErrorMessage ? (
        <p className="mt-3 text-sm text-rose-300">{channelErrorMessage}</p>
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
                      onChannelChange();
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
                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                  isSelected
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
                    : "border-slate-700 bg-slate-900 text-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onChannelChange();
                    navigate(createAppPath(selectedServerId, channel.id));
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate font-medium"># {channel.name}</p>
                </button>
                {channel.canDelete ? (
                  <button
                    type="button"
                    onClick={() => void handleDeleteChannel(channel.id)}
                    disabled={deletingChannelId === channel.id}
                    className="inline-flex items-center rounded-full border border-rose-300/40 bg-rose-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingChannelId === channel.id
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
