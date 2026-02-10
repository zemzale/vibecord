import { ConvexError } from "convex/values";
import { useMutation } from "convex/react";
import {
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { createServerMutation, joinServerMutation } from "../lib/servers";
import type { SessionUser } from "../lib/auth";
import { createAppPath, FRIENDS_SERVER_ID, type AppRoute } from "./routing";
import { useAppServers } from "./useAppServers";

type ServersSidebarProps = {
  activeUser: SessionUser;
  sessionToken: string;
  route: Extract<AppRoute, { kind: "app" }>;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  onServerChange: () => void;
  setGlobalServerError: Dispatch<SetStateAction<string | null>>;
  globalServerError: string | null;
};

export function ServersSidebar({
  activeUser,
  sessionToken,
  route,
  navigate,
  onServerChange,
  setGlobalServerError,
  globalServerError,
}: ServersSidebarProps) {
  const [serverName, setServerName] = useState("");
  const [joinServerId, setJoinServerId] = useState("");
  const [joinServerErrorMessage, setJoinServerErrorMessage] = useState<
    string | null
  >(null);
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [isJoiningServer, setIsJoiningServer] = useState(false);
  const [isServerActionsOpen, setIsServerActionsOpen] = useState(false);

  const createServer = useMutation(createServerMutation);
  const joinServer = useMutation(joinServerMutation);
  const { appServers, myServers, directMessageChannels } = useAppServers({
    activeUser,
    sessionToken,
  });

  useEffect(() => {
    if (!myServers || !directMessageChannels) {
      return;
    }

    const hasServerSelection = route.serverId
      ? appServers.some((server) => server.id === route.serverId)
      : false;

    if (!hasServerSelection) {
      navigate(createAppPath(FRIENDS_SERVER_ID, null), { replace: true });
    }
  }, [appServers, directMessageChannels, myServers, navigate, route.serverId]);

  async function handleCreateServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGlobalServerError(null);
    setIsCreatingServer(true);

    try {
      const server = await createServer({
        sessionToken,
        name: serverName,
      });
      setServerName("");
      onServerChange();
      navigate(createAppPath(server.id, null));
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setGlobalServerError(error.data);
      } else {
        setGlobalServerError(
          "Unable to create server right now. Please try again.",
        );
      }
    } finally {
      setIsCreatingServer(false);
    }
  }

  async function handleJoinServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJoinServerErrorMessage(null);
    setGlobalServerError(null);
    setIsJoiningServer(true);

    try {
      const server = await joinServer({
        sessionToken,
        serverId: joinServerId.trim(),
      });
      setJoinServerId("");
      onServerChange();
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

  return (
    <aside
      aria-label="Servers"
      className="relative border-b border-slate-800 bg-slate-950 p-3 lg:border-r lg:border-b-0"
    >
      <p className="mb-2 hidden text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 lg:block">
        Servers
      </p>

      {myServers === undefined || directMessageChannels === undefined ? (
        <p className="px-2 py-3 text-xs text-slate-400">Loading...</p>
      ) : (
        <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {appServers.map((server) => {
            const isSelected = route.serverId === server.id;
            const initials =
              server.id === FRIENDS_SERVER_ID
                ? "FR"
                : server.name.slice(0, 2).toUpperCase();

            return (
              <li key={server.id}>
                <button
                  type="button"
                  onClick={() => {
                    onServerChange();
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

          <li>
            <button
              type="button"
              onClick={() => setIsServerActionsOpen((current) => !current)}
              title="Create or join server"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-2xl leading-none text-cyan-100 transition hover:border-cyan-300 hover:bg-slate-800 lg:h-14 lg:w-14"
            >
              +
            </button>
          </li>
        </ul>
      )}

      {isServerActionsOpen ? (
        <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900 p-3 lg:absolute lg:left-full lg:top-3 lg:z-20 lg:mt-0 lg:ml-3 lg:w-72">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Server actions
          </p>

          <form className="mt-3 space-y-2" onSubmit={handleCreateServer}>
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
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
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
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none transition focus:border-cyan-300"
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

          {globalServerError ? (
            <p className="mt-3 text-sm text-rose-300">{globalServerError}</p>
          ) : null}
          {joinServerErrorMessage ? (
            <p className="mt-2 text-sm text-rose-300">
              {joinServerErrorMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
