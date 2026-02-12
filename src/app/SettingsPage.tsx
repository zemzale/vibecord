import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createChannelMutation,
  deleteChannelMutation,
  getChannelDeletionStatusQuery,
  listChannelsQuery,
} from "../lib/channels";
import {
  createServerMutation,
  deleteServerMutation,
  getServerDeletionStatusQuery,
  joinServerMutation,
  leaveServerMutation,
} from "../lib/servers";
import type { SessionUser } from "../lib/auth";
import {
  createSettingsPath,
  FRIENDS_SERVER_ID,
  type AppRoute,
} from "./routing";
import { useAppServers } from "./useAppServers";

type SettingsPageProps = {
  activeUser: SessionUser;
  sessionToken: string;
  route: Extract<AppRoute, { kind: "app"; section: "settings" }>;
  navigate: (path: string, options?: { replace?: boolean }) => void;
};

export function SettingsPage({
  activeUser,
  sessionToken,
  route,
  navigate,
}: SettingsPageProps) {
  const [serverName, setServerName] = useState("");
  const [joinServerId, setJoinServerId] = useState("");
  const [channelName, setChannelName] = useState("");
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [isJoiningServer, setIsJoiningServer] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [leavingServerId, setLeavingServerId] = useState<string | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(
    null,
  );
  const [activeServerDeletionId, setActiveServerDeletionId] = useState<
    string | null
  >(null);
  const [activeChannelDeletionId, setActiveChannelDeletionId] = useState<
    string | null
  >(null);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);

  const createServer = useMutation(createServerMutation);
  const joinServer = useMutation(joinServerMutation);
  const leaveServer = useMutation(leaveServerMutation);
  const deleteServer = useMutation(deleteServerMutation);
  const createChannel = useMutation(createChannelMutation);
  const deleteChannel = useMutation(deleteChannelMutation);

  const { appServers } = useAppServers({ activeUser, sessionToken });

  const manageableServers = useMemo(
    () => appServers.filter((server) => server.id !== FRIENDS_SERVER_ID),
    [appServers],
  );

  const selectedServerId = useMemo(() => {
    if (route.serverId) {
      const fromRoute = manageableServers.find(
        (server) => server.id === route.serverId,
      );
      if (fromRoute) {
        return fromRoute.id;
      }
    }

    return manageableServers[0]?.id ?? null;
  }, [manageableServers, route.serverId]);

  const selectedServer = useMemo(
    () =>
      manageableServers.find((server) => server.id === selectedServerId) ??
      null,
    [manageableServers, selectedServerId],
  );

  const channels = useQuery(
    listChannelsQuery,
    selectedServerId ? { sessionToken, serverId: selectedServerId } : "skip",
  );
  const serverDeletionStatus = useQuery(
    getServerDeletionStatusQuery,
    activeServerDeletionId
      ? { sessionToken, serverId: activeServerDeletionId }
      : "skip",
  );
  const channelDeletionStatus = useQuery(
    getChannelDeletionStatusQuery,
    activeChannelDeletionId
      ? { sessionToken, channelId: activeChannelDeletionId }
      : "skip",
  );

  useEffect(() => {
    if (!activeServerDeletionId || !serverDeletionStatus) {
      return;
    }

    if (serverDeletionStatus.status === "completed") {
      setOperationMessage(
        `Server delete completed. Removed ${serverDeletionStatus.deletedChannels} channels, ${serverDeletionStatus.deletedMessages} messages, and ${serverDeletionStatus.deletedMemberships} memberships.`,
      );
      setActiveServerDeletionId(null);
      navigate(createSettingsPath(null), { replace: true });
      return;
    }

    setOperationMessage(
      `Deleting server... ${serverDeletionStatus.deletedChannels} channels, ${serverDeletionStatus.deletedMessages} messages, and ${serverDeletionStatus.deletedMemberships} memberships removed so far.`,
    );
  }, [activeServerDeletionId, navigate, serverDeletionStatus]);

  useEffect(() => {
    if (!activeChannelDeletionId || !channelDeletionStatus) {
      return;
    }

    if (channelDeletionStatus.status === "completed") {
      setOperationMessage(
        `Channel delete completed. Removed ${channelDeletionStatus.deletedMessages} messages.`,
      );
      setActiveChannelDeletionId(null);
      return;
    }

    setOperationMessage(
      `Deleting channel... ${channelDeletionStatus.deletedMessages} messages removed so far.`,
    );
  }, [activeChannelDeletionId, channelDeletionStatus]);

  async function handleCreateServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormErrorMessage(null);
    setIsCreatingServer(true);

    try {
      const server = await createServer({
        sessionToken,
        name: serverName,
      });
      setServerName("");
      navigate(createSettingsPath(server.id));
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setFormErrorMessage(error.data);
      } else {
        setFormErrorMessage(
          "Unable to create server right now. Please try again.",
        );
      }
    } finally {
      setIsCreatingServer(false);
    }
  }

  async function handleJoinServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormErrorMessage(null);
    setIsJoiningServer(true);

    try {
      const server = await joinServer({
        sessionToken,
        serverId: joinServerId.trim(),
      });
      setJoinServerId("");
      navigate(createSettingsPath(server.id));
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setFormErrorMessage(error.data);
      } else {
        setFormErrorMessage(
          "Unable to join this server right now. Please try again.",
        );
      }
    } finally {
      setIsJoiningServer(false);
    }
  }

  async function handleCreateChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedServerId) {
      setFormErrorMessage("Create or join a server before creating channels.");
      return;
    }

    setFormErrorMessage(null);
    setIsCreatingChannel(true);

    try {
      await createChannel({
        sessionToken,
        serverId: selectedServerId,
        name: channelName,
      });
      setChannelName("");
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setFormErrorMessage(error.data);
      } else {
        setFormErrorMessage(
          "Unable to create this channel right now. Please try again.",
        );
      }
    } finally {
      setIsCreatingChannel(false);
    }
  }

  async function handleDeleteChannel(channelId: string) {
    setFormErrorMessage(null);
    setOperationMessage(null);
    setDeletingChannelId(channelId);

    try {
      const result = await deleteChannel({ sessionToken, channelId });
      if (result.status === "completed") {
        setOperationMessage(
          `Channel delete completed. Removed ${result.deletedMessages} messages.`,
        );
        setActiveChannelDeletionId(null);
      } else {
        setOperationMessage("Channel deletion started.");
        setActiveChannelDeletionId(channelId);
      }
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setFormErrorMessage(error.data);
      } else {
        setFormErrorMessage(
          "Unable to delete this channel right now. Please try again.",
        );
      }
    } finally {
      setDeletingChannelId(null);
    }
  }

  async function handleLeaveServer(serverId: string) {
    setFormErrorMessage(null);
    setOperationMessage(null);
    setLeavingServerId(serverId);

    try {
      await leaveServer({ sessionToken, serverId });
      navigate(createSettingsPath(null));
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setFormErrorMessage(error.data);
      } else {
        setFormErrorMessage(
          "Unable to leave this server right now. Please try again.",
        );
      }
    } finally {
      setLeavingServerId(null);
    }
  }

  async function handleDeleteServer(serverId: string) {
    setFormErrorMessage(null);
    setOperationMessage(null);
    setDeletingServerId(serverId);

    try {
      const result = await deleteServer({ sessionToken, serverId });
      if (result.status === "completed") {
        setOperationMessage(
          `Server delete completed. Removed ${result.deletedChannels} channels, ${result.deletedMessages} messages, and ${result.deletedMemberships} memberships.`,
        );
        setActiveServerDeletionId(null);
        navigate(createSettingsPath(null), { replace: true });
      } else {
        setOperationMessage("Server deletion started.");
        setActiveServerDeletionId(serverId);
      }
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setFormErrorMessage(error.data);
      } else {
        setFormErrorMessage(
          "Unable to delete this server right now. Please try again.",
        );
      }
    } finally {
      setDeletingServerId(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl p-4 lg:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
        Settings
      </h2>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <form
          className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
          onSubmit={handleCreateServer}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Create server
          </p>
          <input
            type="text"
            name="serverName"
            value={serverName}
            onChange={(event) => setServerName(event.target.value)}
            required
            minLength={2}
            maxLength={64}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
            placeholder="Studio Lounge"
          />
          <button
            type="submit"
            disabled={isCreatingServer}
            className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {isCreatingServer ? "Creating server..." : "Create server"}
          </button>
        </form>

        <form
          className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
          onSubmit={handleJoinServer}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Join server by ID
          </p>
          <input
            type="text"
            name="joinServerId"
            value={joinServerId}
            onChange={(event) => setJoinServerId(event.target.value)}
            required
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none transition focus:border-cyan-300"
            placeholder="Enter server ID"
          />
          <button
            type="submit"
            disabled={isJoiningServer}
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isJoiningServer ? "Joining server..." : "Join server"}
          </button>
        </form>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          Server and channel management
        </p>

        {manageableServers.length > 0 ? (
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Selected server
            </span>
            <select
              value={selectedServerId ?? ""}
              onChange={(event) => {
                setFormErrorMessage(null);
                navigate(createSettingsPath(event.target.value || null));
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
            >
              {manageableServers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-400">
            You are not in any servers yet.
          </p>
        )}

        {selectedServer ? (
          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300">
            <p className="font-semibold text-slate-100">
              {selectedServer.name}
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              ID: {selectedServer.id}
            </p>
            <p className="mt-1 uppercase tracking-wide text-slate-400">
              Role:{" "}
              {selectedServer.membershipRole === "owner" ? "Owner" : "Member"}
            </p>
            {selectedServer.membershipRole === "member" ? (
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
            ) : (
              <button
                type="button"
                onClick={() => void handleDeleteServer(selectedServer.id)}
                disabled={
                  deletingServerId === selectedServer.id ||
                  activeServerDeletionId === selectedServer.id
                }
                className="mt-2 inline-flex items-center rounded-full border border-rose-300/40 bg-rose-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingServerId === selectedServer.id
                  ? "Deleting..."
                  : activeServerDeletionId === selectedServer.id
                    ? "Delete in progress..."
                    : "Delete server"}
              </button>
            )}
          </div>
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
              disabled={!selectedServerId}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder={
                selectedServer
                  ? `Create in ${selectedServer.name}`
                  : "Select a server first"
              }
            />
          </label>

          <button
            type="submit"
            disabled={isCreatingChannel || !selectedServerId}
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingChannel ? "Creating channel..." : "Create channel"}
          </button>
        </form>

        {!selectedServerId ? null : channels === undefined ? (
          <p className="mt-3 text-sm text-slate-400">Loading channels...</p>
        ) : channels.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-400">
            No channels in this server yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {channels.map((channel) => (
              <li
                key={channel.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              >
                <p className="truncate font-medium"># {channel.name}</p>
                {channel.canDelete ? (
                  <button
                    type="button"
                    onClick={() => void handleDeleteChannel(channel.id)}
                    disabled={
                      deletingChannelId === channel.id ||
                      activeChannelDeletionId === channel.id
                    }
                    className="inline-flex items-center rounded-full border border-rose-300/40 bg-rose-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingChannelId === channel.id
                      ? "Deleting..."
                      : activeChannelDeletionId === channel.id
                        ? "Delete in progress..."
                        : "Delete"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {formErrorMessage ? (
          <p className="mt-3 text-sm text-rose-300">{formErrorMessage}</p>
        ) : null}

        {operationMessage ? (
          <p className="mt-3 text-sm text-cyan-200">{operationMessage}</p>
        ) : null}
      </div>
    </section>
  );
}
