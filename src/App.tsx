import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import {
  getSessionUserQuery,
  loginMutation,
  logoutMutation,
  registerMutation,
  SESSION_TOKEN_STORAGE_KEY,
  SOCIAL_AUTH_PROVIDERS,
  type SessionUser,
} from "./lib/auth";
import {
  createServerMutation,
  deleteServerMutation,
  joinServerMutation,
  leaveServerMutation,
  listMyServersQuery,
} from "./lib/servers";
import {
  createChannelMutation,
  deleteChannelMutation,
  listChannelsQuery,
} from "./lib/channels";
import {
  deleteMessageMutation,
  listMessagesQuery,
  sendMessageMutation,
} from "./lib/messages";

type AppRoute =
  | { kind: "login" }
  | { kind: "register" }
  | {
      kind: "app";
      serverId: string | null;
      channelId: string | null;
    };

const LOGIN_PATH = "/login";
const REGISTER_PATH = "/register";
const APP_PATH = "/app";

function readInitialSessionToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  return token && token.length > 0 ? token : null;
}

function safeDecodePathSegment(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(value);
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

function parseRoute(pathname: string): AppRoute {
  if (pathname === REGISTER_PATH) {
    return { kind: "register" };
  }

  if (pathname === LOGIN_PATH || pathname === "/") {
    return { kind: "login" };
  }

  const parts = pathname.split("/").filter((part) => part.length > 0);
  if (parts.length === 0 || parts[0] !== "app") {
    return { kind: "login" };
  }

  if (parts.length === 1) {
    return { kind: "app", serverId: null, channelId: null };
  }

  if (parts.length === 3 && parts[1] === "servers") {
    return {
      kind: "app",
      serverId: safeDecodePathSegment(parts[2]),
      channelId: null,
    };
  }

  if (parts.length === 5 && parts[1] === "servers" && parts[3] === "channels") {
    return {
      kind: "app",
      serverId: safeDecodePathSegment(parts[2]),
      channelId: safeDecodePathSegment(parts[4]),
    };
  }

  return { kind: "app", serverId: null, channelId: null };
}

function createAppPath(
  serverId: string | null,
  channelId: string | null,
): string {
  if (!serverId) {
    return APP_PATH;
  }

  const encodedServerId = encodeURIComponent(serverId);
  if (!channelId) {
    return `${APP_PATH}/servers/${encodedServerId}`;
  }

  const encodedChannelId = encodeURIComponent(channelId);
  return `${APP_PATH}/servers/${encodedServerId}/channels/${encodedChannelId}`;
}

function App() {
  const [pathname, setPathname] = useState(() =>
    typeof window === "undefined" ? LOGIN_PATH : window.location.pathname,
  );
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverName, setServerName] = useState("");
  const [channelName, setChannelName] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [joinServerId, setJoinServerId] = useState("");
  const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(
    null,
  );
  const [joinServerErrorMessage, setJoinServerErrorMessage] = useState<
    string | null
  >(null);
  const [leaveServerErrorMessage, setLeaveServerErrorMessage] = useState<
    string | null
  >(null);
  const [deleteServerErrorMessage, setDeleteServerErrorMessage] = useState<
    string | null
  >(null);
  const [channelErrorMessage, setChannelErrorMessage] = useState<string | null>(
    null,
  );
  const [messageErrorMessage, setMessageErrorMessage] = useState<string | null>(
    null,
  );
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isJoiningServer, setIsJoiningServer] = useState(false);
  const [leavingServerId, setLeavingServerId] = useState<string | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(
    null,
  );
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null,
  );
  const [sessionToken, setSessionToken] = useState<string | null>(
    readInitialSessionToken,
  );
  const [freshUser, setFreshUser] = useState<SessionUser | null>(null);

  const register = useMutation(registerMutation);
  const login = useMutation(loginMutation);
  const logout = useMutation(logoutMutation);
  const createServer = useMutation(createServerMutation);
  const createChannel = useMutation(createChannelMutation);
  const sendMessage = useMutation(sendMessageMutation);
  const deleteMessage = useMutation(deleteMessageMutation);
  const deleteChannel = useMutation(deleteChannelMutation);
  const joinServer = useMutation(joinServerMutation);
  const leaveServer = useMutation(leaveServerMutation);
  const deleteServer = useMutation(deleteServerMutation);

  const route = useMemo(() => parseRoute(pathname), [pathname]);
  const selectedServerId = route.kind === "app" ? route.serverId : null;
  const selectedChannelId = route.kind === "app" ? route.channelId : null;

  const sessionUser = useQuery(
    getSessionUserQuery,
    sessionToken ? { sessionToken } : "skip",
  );
  const activeUser = useMemo(
    () => (sessionUser === undefined ? freshUser : sessionUser),
    [freshUser, sessionUser],
  );
  const myServers = useQuery(
    listMyServersQuery,
    activeUser && sessionToken ? { sessionToken } : "skip",
  );
  const selectedServer = useMemo(
    () => myServers?.find((server) => server.id === selectedServerId) ?? null,
    [myServers, selectedServerId],
  );
  const channels = useQuery(
    listChannelsQuery,
    activeUser && sessionToken && selectedServerId
      ? { sessionToken, serverId: selectedServerId }
      : "skip",
  );
  const selectedChannel = useMemo(
    () => channels?.find((channel) => channel.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );
  const messages = useQuery(
    listMessagesQuery,
    activeUser && sessionToken && selectedChannelId
      ? { sessionToken, channelId: selectedChannelId }
      : "skip",
  );

  function navigate(nextPath: string, options?: { replace?: boolean }) {
    if (typeof window === "undefined") {
      return;
    }

    const currentPath = window.location.pathname;
    if (currentPath === nextPath) {
      return;
    }

    if (options?.replace) {
      window.history.replaceState(null, "", nextPath);
    } else {
      window.history.pushState(null, "", nextPath);
    }

    setPathname(window.location.pathname);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!sessionToken || sessionUser !== null) {
      return;
    }

    setFreshUser(null);
    setSessionToken(null);
    window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    navigate(LOGIN_PATH, { replace: true });
  }, [sessionToken, sessionUser]);

  useEffect(() => {
    if (!activeUser) {
      if (route.kind === "app") {
        navigate(LOGIN_PATH, { replace: true });
      }
      return;
    }

    if (route.kind !== "app") {
      navigate(APP_PATH, { replace: true });
    }
  }, [activeUser, route]);

  useEffect(() => {
    if (!activeUser || route.kind !== "app") {
      return;
    }

    if (!myServers) {
      return;
    }

    if (myServers.length === 0) {
      if (route.serverId || route.channelId) {
        navigate(APP_PATH, { replace: true });
      }
      return;
    }

    const hasServerSelection = route.serverId
      ? myServers.some((server) => server.id === route.serverId)
      : false;
    if (!hasServerSelection) {
      navigate(createAppPath(myServers[0].id, null), { replace: true });
      return;
    }
  }, [activeUser, myServers, route]);

  useEffect(() => {
    if (!activeUser || route.kind !== "app" || !route.serverId) {
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

    const hasChannelSelection = route.channelId
      ? channels.some((channel) => channel.id === route.channelId)
      : false;

    if (!hasChannelSelection) {
      navigate(createAppPath(route.serverId, channels[0].id), {
        replace: true,
      });
    }
  }, [activeUser, channels, route]);

  function persistSession(nextSessionToken: string) {
    setSessionToken(nextSessionToken);
    window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, nextSessionToken);
  }

  function clearLocalSession() {
    setFreshUser(null);
    setSessionToken(null);
    setChannelName("");
    setChannelErrorMessage(null);
    setMessageContent("");
    setMessageErrorMessage(null);
    window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    navigate(LOGIN_PATH, { replace: true });
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await register({
        loginName,
        password,
      });

      setFreshUser(result.user);
      persistSession(result.sessionToken);
      setLoginName("");
      setPassword("");
      navigate(APP_PATH, { replace: true });
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setErrorMessage(error.data);
      } else {
        setErrorMessage("Unable to create account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await login({
        loginName,
        password,
      });

      setFreshUser(result.user);
      persistSession(result.sessionToken);
      setLoginName("");
      setPassword("");
      navigate(APP_PATH, { replace: true });
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setErrorMessage(error.data);
      } else {
        setErrorMessage("Invalid login credentials.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    const activeToken = sessionToken;
    if (activeToken) {
      try {
        await logout({ sessionToken: activeToken });
      } catch (error) {
        void error;
      }
    }

    clearLocalSession();
  }

  async function handleCreateServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionToken) {
      setServerErrorMessage("You must be logged in to create a server.");
      return;
    }

    setServerErrorMessage(null);
    setIsCreatingServer(true);

    try {
      const server = await createServer({
        sessionToken,
        name: serverName,
      });
      setServerName("");
      navigate(createAppPath(server.id, null));
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setServerErrorMessage(error.data);
      } else {
        setServerErrorMessage(
          "Unable to create server right now. Please try again.",
        );
      }
    } finally {
      setIsCreatingServer(false);
    }
  }

  async function handleCreateChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionToken) {
      setChannelErrorMessage("You must be logged in to create a channel.");
      return;
    }

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
    if (!sessionToken) {
      setChannelErrorMessage("You must be logged in to delete a channel.");
      return;
    }

    setChannelErrorMessage(null);
    setDeletingChannelId(channelId);

    try {
      await deleteChannel({
        sessionToken,
        channelId,
      });
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

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionToken) {
      setMessageErrorMessage("You must be logged in to send messages.");
      return;
    }

    if (!selectedChannelId) {
      setMessageErrorMessage("Select a channel before sending a message.");
      return;
    }

    setMessageErrorMessage(null);
    setIsSendingMessage(true);

    try {
      await sendMessage({
        sessionToken,
        channelId: selectedChannelId,
        content: messageContent,
      });
      setMessageContent("");
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setMessageErrorMessage(error.data);
      } else {
        setMessageErrorMessage(
          "Unable to send this message right now. Please try again.",
        );
      }
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!sessionToken) {
      setMessageErrorMessage("You must be logged in to delete messages.");
      return;
    }

    setMessageErrorMessage(null);
    setDeletingMessageId(messageId);

    try {
      await deleteMessage({
        sessionToken,
        messageId,
      });
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setMessageErrorMessage(error.data);
      } else {
        setMessageErrorMessage(
          "Unable to delete this message right now. Please try again.",
        );
      }
    } finally {
      setDeletingMessageId(null);
    }
  }

  async function handleJoinServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionToken) {
      setJoinServerErrorMessage("You must be logged in to join a server.");
      return;
    }

    setJoinServerErrorMessage(null);
    setLeaveServerErrorMessage(null);
    setDeleteServerErrorMessage(null);
    setIsJoiningServer(true);

    try {
      const server = await joinServer({
        sessionToken,
        serverId: joinServerId.trim(),
      });
      setJoinServerId("");
      navigate(createAppPath(server.id, null));
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setJoinServerErrorMessage(error.data);
      } else {
        setJoinServerErrorMessage(
          "Unable to join this server right now. Please try again.",
        );
      }
    } finally {
      setIsJoiningServer(false);
    }
  }

  async function handleLeaveServer(serverId: string) {
    if (!sessionToken) {
      setLeaveServerErrorMessage("You must be logged in to leave a server.");
      return;
    }

    setLeaveServerErrorMessage(null);
    setJoinServerErrorMessage(null);
    setDeleteServerErrorMessage(null);
    setLeavingServerId(serverId);

    try {
      await leaveServer({
        sessionToken,
        serverId,
      });

      if (selectedServerId === serverId) {
        navigate(APP_PATH);
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
    if (!sessionToken) {
      setDeleteServerErrorMessage("You must be logged in to delete a server.");
      return;
    }

    setDeleteServerErrorMessage(null);
    setLeaveServerErrorMessage(null);
    setJoinServerErrorMessage(null);
    setDeletingServerId(serverId);

    try {
      await deleteServer({
        sessionToken,
        serverId,
      });

      if (selectedServerId === serverId) {
        navigate(APP_PATH);
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

  const isAuthPage = route.kind === "login" || route.kind === "register";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2a52_0%,_#0f1224_45%,_#090b16_100%)] px-3 py-4 text-slate-100 sm:px-5 lg:px-8 lg:py-6">
      {activeUser && route.kind === "app" ? (
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3">
          <header className="rounded-2xl border border-slate-800/80 bg-slate-950/70 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">
                  VibeCord
                </p>
                <h1 className="text-xl font-semibold text-white">
                  Signed in as {activeUser.loginName}
                </h1>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Logout
              </button>
            </div>
          </header>

          <div className="grid gap-3 lg:grid-cols-[5.5rem_20rem_minmax(0,1fr)]">
            <aside
              aria-label="Servers"
              className="rounded-2xl border border-slate-800/80 bg-slate-950/65 p-3 shadow-lg shadow-black/30 backdrop-blur"
            >
              <p className="mb-2 hidden text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 lg:block">
                Servers
              </p>
              {myServers === undefined ? (
                <p className="px-2 py-3 text-xs text-slate-400">Loading...</p>
              ) : myServers.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-3 py-5 text-center text-xs text-slate-400">
                  Create a server to get started.
                </p>
              ) : (
                <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                  {myServers.map((server) => {
                    const isSelected = selectedServerId === server.id;
                    const initials = server.name.slice(0, 2).toUpperCase();

                    return (
                      <li key={server.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setChannelErrorMessage(null);
                            setMessageErrorMessage(null);
                            navigate(createAppPath(server.id, null));
                          }}
                          title={server.name}
                          className={`relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold transition lg:h-14 lg:w-14 ${
                            isSelected
                              ? "border-cyan-300 bg-cyan-400/25 text-cyan-100 shadow-lg shadow-cyan-500/20"
                              : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800"
                          }`}
                        >
                          {initials}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>

            <section
              aria-label="Channels"
              className="rounded-2xl border border-slate-800/80 bg-slate-950/65 p-4 shadow-lg shadow-black/30 backdrop-blur"
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
                    setMessageErrorMessage(null);
                    navigate(createAppPath(event.target.value || null, null));
                  }}
                  disabled={!myServers || myServers.length === 0}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950"
                >
                  {myServers && myServers.length > 0 ? (
                    myServers.map((server) => (
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
                  <p className="font-semibold text-slate-100">
                    {selectedServer.name}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">
                    ID: {selectedServer.id}
                  </p>
                  <p className="mt-1 uppercase tracking-wide text-slate-400">
                    Role:{" "}
                    {selectedServer.membershipRole === "owner"
                      ? "Owner"
                      : "Member"}
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
                  ) : selectedServer.membershipRole === "owner" ? (
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

              <form className="mt-4 space-y-2" onSubmit={handleCreateServer}>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Create server
                  </span>
                  <input
                    type="text"
                    name="serverName"
                    value={serverName}
                    onChange={(event) => setServerName(event.target.value)}
                    required
                    minLength={2}
                    maxLength={64}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
                    placeholder="Studio Lounge"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isCreatingServer}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                >
                  {isCreatingServer ? "Creating server..." : "Create server"}
                </button>
              </form>

              <form className="mt-4 space-y-2" onSubmit={handleJoinServer}>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Join server by ID
                  </span>
                  <input
                    type="text"
                    name="joinServerId"
                    value={joinServerId}
                    onChange={(event) => setJoinServerId(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 outline-none transition focus:border-cyan-300"
                    placeholder="Enter server ID"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isJoiningServer}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isJoiningServer ? "Joining server..." : "Join server"}
                </button>
              </form>

              {serverErrorMessage ? (
                <p className="mt-3 text-sm text-rose-300">
                  {serverErrorMessage}
                </p>
              ) : null}
              {joinServerErrorMessage ? (
                <p className="mt-2 text-sm text-rose-300">
                  {joinServerErrorMessage}
                </p>
              ) : null}
              {leaveServerErrorMessage ? (
                <p className="mt-2 text-sm text-rose-300">
                  {leaveServerErrorMessage}
                </p>
              ) : null}
              {deleteServerErrorMessage ? (
                <p className="mt-2 text-sm text-rose-300">
                  {deleteServerErrorMessage}
                </p>
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
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950"
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

              {channelErrorMessage ? (
                <p className="mt-3 text-sm text-rose-300">
                  {channelErrorMessage}
                </p>
              ) : null}

              {!selectedServerId ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-400">
                  Select a server to view its channels.
                </p>
              ) : channels === undefined ? (
                <p className="mt-3 text-sm text-slate-400">
                  Loading channels...
                </p>
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
                            setMessageErrorMessage(null);
                            navigate(
                              createAppPath(selectedServerId, channel.id),
                            );
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate font-medium">
                            # {channel.name}
                          </p>
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

            <section
              aria-label="Messages"
              className="rounded-2xl border border-slate-800/80 bg-slate-950/65 p-4 shadow-lg shadow-black/30 backdrop-blur"
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Messages
              </h2>

              {!selectedServerId ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-400">
                  Select a server to start chatting.
                </p>
              ) : !selectedChannelId ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-400">
                  Select a channel to read and send messages.
                </p>
              ) : (
                <>
                  <p className="mt-3 rounded-xl border border-slate-700 bg-slate-900/70 p-2 text-xs text-slate-300">
                    Chatting in{" "}
                    <span className="font-semibold text-cyan-100">
                      # {selectedChannel?.name ?? "Unknown channel"}
                    </span>
                  </p>

                  <form className="mt-3 space-y-3" onSubmit={handleSendMessage}>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                        Message
                      </span>
                      <textarea
                        name="messageContent"
                        value={messageContent}
                        onChange={(event) =>
                          setMessageContent(event.target.value)
                        }
                        required
                        minLength={1}
                        maxLength={2000}
                        rows={3}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
                        placeholder="Write a message"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isSendingMessage}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                    >
                      {isSendingMessage ? "Sending..." : "Send message"}
                    </button>
                  </form>

                  {messageErrorMessage ? (
                    <p className="mt-3 text-sm text-rose-300">
                      {messageErrorMessage}
                    </p>
                  ) : null}

                  {messages === undefined ? (
                    <p className="mt-3 text-sm text-slate-400">
                      Loading messages...
                    </p>
                  ) : messages.length === 0 ? (
                    <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-400">
                      No messages yet. Start the conversation.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {messages.map((message) => (
                        <li
                          key={message.id}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-cyan-100">
                                {message.authorLoginName}
                              </p>
                              <p className="shrink-0 text-[11px] text-slate-400">
                                {new Date(message.createdAt).toLocaleString()}
                              </p>
                            </div>
                            {message.canDelete ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteMessage(message.id)
                                }
                                disabled={deletingMessageId === message.id}
                                className="inline-flex items-center rounded-full border border-rose-300/40 bg-rose-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingMessageId === message.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            ) : null}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-slate-200">
                            {message.content}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      ) : isAuthPage ? (
        <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl shadow-black/35 backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            VibeCord
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {route.kind === "login"
              ? "Login to access your account."
              : "Create your account to continue."}
          </p>

          <div className="mt-4 space-y-2" aria-label="Social sign-in providers">
            {SOCIAL_AUTH_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                disabled
                className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-500"
              >
                {provider.label} (coming soon)
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            OAuth providers are planned. Use login name + password for this MVP.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={
              route.kind === "login" ? handleLoginSubmit : handleRegisterSubmit
            }
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-300">
                Login name
              </span>
              <input
                type="text"
                name="loginName"
                autoComplete="username"
                value={loginName}
                onChange={(event) => setLoginName(event.target.value)}
                required
                minLength={3}
                maxLength={24}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-300">
                Password
              </span>
              <input
                type="password"
                name="password"
                autoComplete={
                  route.kind === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
              />
            </label>

            {errorMessage ? (
              <p className="text-sm text-rose-300">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              {isSubmitting
                ? route.kind === "login"
                  ? "Logging in..."
                  : "Creating account..."
                : route.kind === "login"
                  ? "Login"
                  : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-sm text-slate-300">
            {route.kind === "login"
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                navigate(route.kind === "login" ? REGISTER_PATH : LOGIN_PATH);
              }}
              className="font-medium text-cyan-200 underline-offset-2 hover:underline"
            >
              {route.kind === "login" ? "Register" : "Login"}
            </button>
          </p>
        </section>
      ) : null}
    </main>
  );
}

export default App;
