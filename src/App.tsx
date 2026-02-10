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
import {
  listDirectMessageChannelsQuery,
  listDirectMessagesQuery,
  listFriendRequestsQuery,
  listFriendsQuery,
  respondToFriendRequestMutation,
  sendDirectMessageMutation,
  sendFriendRequestMutation,
} from "./lib/friends";

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
const FRIENDS_SERVER_ID = "friends";

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
  const [friendLoginName, setFriendLoginName] = useState("");
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
  const [friendErrorMessage, setFriendErrorMessage] = useState<string | null>(
    null,
  );
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isJoiningServer, setIsJoiningServer] = useState(false);
  const [isSendingFriendRequest, setIsSendingFriendRequest] = useState(false);
  const [leavingServerId, setLeavingServerId] = useState<string | null>(null);
  const [respondingFriendRequestId, setRespondingFriendRequestId] = useState<
    string | null
  >(null);
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
  const sendFriendRequest = useMutation(sendFriendRequestMutation);
  const respondToFriendRequest = useMutation(respondToFriendRequestMutation);
  const sendDirectMessage = useMutation(sendDirectMessageMutation);

  const route = useMemo(() => parseRoute(pathname), [pathname]);
  const selectedServerId = route.kind === "app" ? route.serverId : null;
  const selectedChannelId = route.kind === "app" ? route.channelId : null;
  const isFriendsServerSelected = selectedServerId === FRIENDS_SERVER_ID;

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
  const directMessageChannels = useQuery(
    listDirectMessageChannelsQuery,
    activeUser && sessionToken ? { sessionToken } : "skip",
  );
  const appServers = useMemo(
    () =>
      activeUser
        ? [
            {
              id: FRIENDS_SERVER_ID,
              name: "Friends",
              ownerId: activeUser.id,
              createdAt: Number.MAX_SAFE_INTEGER,
              membershipRole: "owner" as const,
            },
            ...(myServers ?? []),
          ]
        : [],
    [activeUser, myServers],
  );
  const selectedServer = useMemo(
    () => appServers.find((server) => server.id === selectedServerId) ?? null,
    [appServers, selectedServerId],
  );
  const channels = useQuery(
    listChannelsQuery,
    activeUser && sessionToken && selectedServerId && !isFriendsServerSelected
      ? { sessionToken, serverId: selectedServerId }
      : "skip",
  );
  const selectedDirectMessageChannel = useMemo(
    () =>
      directMessageChannels?.find(
        (channel) => channel.id === selectedChannelId,
      ) ?? null,
    [directMessageChannels, selectedChannelId],
  );
  const selectedServerChannel = useMemo(
    () => channels?.find((channel) => channel.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );
  const messages = useQuery(
    isFriendsServerSelected ? listDirectMessagesQuery : listMessagesQuery,
    activeUser && sessionToken && selectedChannelId
      ? isFriendsServerSelected
        ? { sessionToken, friendshipId: selectedChannelId }
        : { sessionToken, channelId: selectedChannelId }
      : "skip",
  );
  const friendRequests = useQuery(
    listFriendRequestsQuery,
    activeUser && sessionToken ? { sessionToken } : "skip",
  );
  const friends = useQuery(
    listFriendsQuery,
    activeUser && sessionToken ? { sessionToken } : "skip",
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

    if (!myServers || !directMessageChannels) {
      return;
    }

    const hasServerSelection = route.serverId
      ? appServers.some((server) => server.id === route.serverId)
      : false;
    if (!hasServerSelection) {
      navigate(createAppPath(FRIENDS_SERVER_ID, null), { replace: true });
      return;
    }
  }, [activeUser, appServers, directMessageChannels, myServers, route]);

  useEffect(() => {
    if (!activeUser || route.kind !== "app" || !route.serverId) {
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

      const hasDirectMessageSelection = route.channelId
        ? directMessageChannels.some(
            (channel) => channel.id === route.channelId,
          )
        : false;

      if (!hasDirectMessageSelection) {
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

    const hasChannelSelection = route.channelId
      ? channels.some((channel) => channel.id === route.channelId)
      : false;

    if (!hasChannelSelection) {
      navigate(createAppPath(route.serverId, channels[0].id), {
        replace: true,
      });
    }
  }, [activeUser, channels, directMessageChannels, route]);

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
    setFriendLoginName("");
    setFriendErrorMessage(null);
    window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    navigate(LOGIN_PATH, { replace: true });
  }

  async function handleSendFriendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionToken) {
      setFriendErrorMessage("You must be logged in to send a friend request.");
      return;
    }

    setFriendErrorMessage(null);
    setIsSendingFriendRequest(true);

    try {
      await sendFriendRequest({
        sessionToken,
        loginName: friendLoginName,
      });
      setFriendLoginName("");
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setFriendErrorMessage(error.data);
      } else {
        setFriendErrorMessage(
          "Unable to send this friend request right now. Please try again.",
        );
      }
    } finally {
      setIsSendingFriendRequest(false);
    }
  }

  async function handleRespondToFriendRequest(
    requestId: string,
    action: "accept" | "decline",
  ) {
    if (!sessionToken) {
      setFriendErrorMessage(
        "You must be logged in to respond to friend requests.",
      );
      return;
    }

    setFriendErrorMessage(null);
    setRespondingFriendRequestId(requestId);

    try {
      await respondToFriendRequest({
        sessionToken,
        requestId,
        action,
      });
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setFriendErrorMessage(error.data);
      } else {
        setFriendErrorMessage(
          "Unable to update this friend request right now. Please try again.",
        );
      }
    } finally {
      setRespondingFriendRequestId(null);
    }
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
      if (isFriendsServerSelected) {
        await sendDirectMessage({
          sessionToken,
          friendshipId: selectedChannelId,
          content: messageContent,
        });
      } else {
        await sendMessage({
          sessionToken,
          channelId: selectedChannelId,
          content: messageContent,
        });
      }
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
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      {activeUser && route.kind === "app" ? (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 lg:grid lg:grid-cols-[20rem_22rem_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  VibeCord
                </h1>
                <p className="text-xs text-slate-500">
                  Signed in as {activeUser.loginName}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Logout
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleCreateServer}>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  New server name
                </span>
                <input
                  type="text"
                  name="serverName"
                  value={serverName}
                  onChange={(event) => setServerName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={64}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring"
                />
              </label>

              {serverErrorMessage ? (
                <p className="text-sm text-red-600">{serverErrorMessage}</p>
              ) : null}

              <button
                type="submit"
                disabled={isCreatingServer}
                className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {isCreatingServer ? "Creating server..." : "Create server"}
              </button>
            </form>

            <form className="mt-4 space-y-3" onSubmit={handleJoinServer}>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Join server by ID
                </span>
                <input
                  type="text"
                  name="joinServerId"
                  value={joinServerId}
                  onChange={(event) => setJoinServerId(event.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm outline-none ring-indigo-200 transition focus:ring"
                  placeholder="Enter server ID"
                />
              </label>

              {joinServerErrorMessage ? (
                <p className="text-sm text-red-600">{joinServerErrorMessage}</p>
              ) : null}

              <button
                type="submit"
                disabled={isJoiningServer}
                className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                {isJoiningServer ? "Joining server..." : "Join server"}
              </button>
            </form>

            {leaveServerErrorMessage ? (
              <p className="mt-4 text-sm text-red-600">
                {leaveServerErrorMessage}
              </p>
            ) : null}
            {deleteServerErrorMessage ? (
              <p className="mt-2 text-sm text-red-600">
                {deleteServerErrorMessage}
              </p>
            ) : null}

            <section
              aria-label="Friends"
              className="mt-4 space-y-3 border-t border-slate-200 pt-4"
            >
              <h2 className="text-sm font-semibold text-slate-700">Friends</h2>
              <form className="space-y-2" onSubmit={handleSendFriendRequest}>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Send request by login name
                  </span>
                  <input
                    type="text"
                    name="friendLoginName"
                    value={friendLoginName}
                    onChange={(event) => setFriendLoginName(event.target.value)}
                    required
                    minLength={3}
                    maxLength={24}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring"
                    placeholder="friend_login"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isSendingFriendRequest}
                  className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  {isSendingFriendRequest
                    ? "Sending request..."
                    : "Send friend request"}
                </button>
              </form>

              {friendErrorMessage ? (
                <p className="text-sm text-red-600">{friendErrorMessage}</p>
              ) : null}

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Incoming requests
                </h3>
                {friendRequests === undefined ? (
                  <p className="text-sm text-slate-500">
                    Loading friend requests...
                  </p>
                ) : friendRequests.incoming.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                    No incoming requests.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {friendRequests.incoming.map((request) => (
                      <li
                        key={request.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                      >
                        <p className="text-sm font-medium text-slate-800">
                          {request.requesterLoginName}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void handleRespondToFriendRequest(
                                request.id,
                                "accept",
                              )
                            }
                            disabled={respondingFriendRequestId === request.id}
                            className="inline-flex items-center rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-500"
                          >
                            {respondingFriendRequestId === request.id
                              ? "Saving..."
                              : "Accept"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleRespondToFriendRequest(
                                request.id,
                                "decline",
                              )
                            }
                            disabled={respondingFriendRequestId === request.id}
                            className="inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            Decline
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Outgoing requests
                </h3>
                {friendRequests === undefined ? (
                  <p className="text-sm text-slate-500">
                    Loading outgoing requests...
                  </p>
                ) : friendRequests.outgoing.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                    No outgoing requests.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {friendRequests.outgoing.map((request) => (
                      <li
                        key={request.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                      >
                        Waiting for {request.recipientLoginName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Confirmed friends
                </h3>
                {friends === undefined ? (
                  <p className="text-sm text-slate-500">Loading friends...</p>
                ) : friends.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                    No friends yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {friends.map((friend) => (
                      <li
                        key={friend.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                      >
                        <p className="font-medium">{friend.loginName}</p>
                        <p className="text-xs text-slate-500">
                          Friends since{" "}
                          {new Date(friend.since).toLocaleDateString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section aria-label="My servers" className="mt-4 space-y-2">
              <h2 className="text-sm font-semibold text-slate-700">
                My servers
              </h2>
              {myServers === undefined ||
              directMessageChannels === undefined ? (
                <p className="text-sm text-slate-500">Loading servers...</p>
              ) : (
                <ul className="space-y-2">
                  {appServers.map((server) => {
                    const isSelected = selectedServerId === server.id;
                    const isFriendsServer = server.id === FRIENDS_SERVER_ID;

                    return (
                      <li
                        key={server.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setChannelErrorMessage(null);
                            setMessageErrorMessage(null);
                            navigate(createAppPath(server.id, null));
                          }}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {server.name}
                              </p>
                              {!isFriendsServer ? (
                                <p className="mt-1 text-xs text-slate-500">
                                  ID: {server.id}
                                </p>
                              ) : null}
                              {isSelected ? (
                                <p className="mt-1 text-xs text-slate-500">
                                  Selected server
                                </p>
                              ) : null}
                            </div>
                            <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600">
                              {isFriendsServer
                                ? "DM"
                                : server.membershipRole === "owner"
                                  ? "Owner"
                                  : "Member"}
                            </span>
                          </div>
                        </button>

                        {!isFriendsServer &&
                        server.membershipRole === "member" ? (
                          <button
                            type="button"
                            onClick={() => void handleLeaveServer(server.id)}
                            disabled={leavingServerId === server.id}
                            className="mt-2 inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            {leavingServerId === server.id
                              ? "Leaving..."
                              : "Leave server"}
                          </button>
                        ) : !isFriendsServer &&
                          server.membershipRole === "owner" ? (
                          <button
                            type="button"
                            onClick={() => void handleDeleteServer(server.id)}
                            disabled={deletingServerId === server.id}
                            className="mt-2 inline-flex items-center rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:text-red-400"
                          >
                            {deletingServerId === server.id
                              ? "Deleting..."
                              : "Delete server"}
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>

          <section
            aria-label="Channels"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 className="text-sm font-semibold text-slate-700">Channels</h2>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Selected server
              </span>
              <select
                value={selectedServerId ?? ""}
                onChange={(event) => {
                  setChannelErrorMessage(null);
                  setMessageErrorMessage(null);
                  navigate(createAppPath(event.target.value || null, null));
                }}
                disabled={!activeUser}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring disabled:cursor-not-allowed disabled:bg-slate-100"
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

            <form className="mt-4 space-y-3" onSubmit={handleCreateChannel}>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  New channel name
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
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring disabled:cursor-not-allowed disabled:bg-slate-100"
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
                  isCreatingChannel ||
                  !selectedServerId ||
                  isFriendsServerSelected
                }
                className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                {isCreatingChannel ? "Creating channel..." : "Create channel"}
              </button>
            </form>

            {channelErrorMessage ? (
              <p className="mt-3 text-sm text-red-600">{channelErrorMessage}</p>
            ) : null}

            {!selectedServerId ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                Select a server to view its channels.
              </p>
            ) : isFriendsServerSelected ? (
              directMessageChannels === undefined ? (
                <p className="mt-3 text-sm text-slate-500">Loading DMs...</p>
              ) : directMessageChannels.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                  Accept a friend request to start a DM channel.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {directMessageChannels.map((channel) => (
                    <li
                      key={channel.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMessageErrorMessage(null);
                          navigate(
                            createAppPath(FRIENDS_SERVER_ID, channel.id),
                          );
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate font-medium">
                          @ {channel.friendLoginName}
                        </p>
                        {selectedChannelId === channel.id ? (
                          <p className="text-xs text-slate-500">
                            Selected conversation
                          </p>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : channels === undefined ? (
              <p className="mt-3 text-sm text-slate-500">Loading channels...</p>
            ) : channels.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                No channels in this server yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {channels.map((channel) => (
                  <li
                    key={channel.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMessageErrorMessage(null);
                        navigate(createAppPath(selectedServerId, channel.id));
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-medium"># {channel.name}</p>
                      {selectedChannelId === channel.id ? (
                        <p className="text-xs text-slate-500">
                          Selected channel
                        </p>
                      ) : null}
                    </button>
                    {channel.canDelete ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteChannel(channel.id)}
                        disabled={deletingChannelId === channel.id}
                        className="inline-flex items-center rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:text-red-400"
                      >
                        {deletingChannelId === channel.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-label="Messages"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 className="text-sm font-semibold text-slate-700">Messages</h2>

            {!selectedServerId ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                Select a server to start chatting.
              </p>
            ) : !selectedChannelId ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                {isFriendsServerSelected
                  ? "Select a DM channel to read and send messages."
                  : "Select a channel to read and send messages."}
              </p>
            ) : (
              <>
                <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                  {isFriendsServerSelected
                    ? "Direct message with"
                    : "Chatting in"}{" "}
                  <span className="font-semibold">
                    {isFriendsServerSelected
                      ? (selectedDirectMessageChannel?.friendLoginName ??
                        "Unknown friend")
                      : `# ${selectedServerChannel?.name ?? "Unknown channel"}`}
                  </span>
                </p>

                <form className="mt-3 space-y-3" onSubmit={handleSendMessage}>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
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
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring"
                      placeholder="Write a message"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isSendingMessage}
                    className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-500"
                  >
                    {isSendingMessage ? "Sending..." : "Send message"}
                  </button>
                </form>

                {messageErrorMessage ? (
                  <p className="mt-3 text-sm text-red-600">
                    {messageErrorMessage}
                  </p>
                ) : null}

                {messages === undefined ? (
                  <p className="mt-3 text-sm text-slate-500">
                    Loading messages...
                  </p>
                ) : messages.length === 0 ? (
                  <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                    No messages yet. Start the conversation.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {messages.map((message) => (
                      <li
                        key={message.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-600">
                              {message.authorLoginName}
                            </p>
                            <p className="shrink-0 text-xs text-slate-500">
                              {new Date(message.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {!isFriendsServerSelected && message.canDelete ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteMessage(message.id)
                              }
                              disabled={deletingMessageId === message.id}
                              className="inline-flex items-center rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:text-red-400"
                            >
                              {deletingMessageId === message.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          ) : null}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">
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
      ) : isAuthPage ? (
        <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">VibeCord</h1>
          <p className="mt-2 text-sm text-slate-600">
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
                className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500"
              >
                {provider.label} (coming soon)
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            OAuth providers are planned. Use login name + password for this MVP.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={
              route.kind === "login" ? handleLoginSubmit : handleRegisterSubmit
            }
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
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
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
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
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring"
              />
            </label>

            {errorMessage ? (
              <p className="text-sm text-red-600">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-500"
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

          <p className="mt-4 text-sm text-slate-600">
            {route.kind === "login"
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                navigate(route.kind === "login" ? REGISTER_PATH : LOGIN_PATH);
              }}
              className="font-medium text-slate-900 underline-offset-2 hover:underline"
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
