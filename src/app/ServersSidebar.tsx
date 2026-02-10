import { useEffect } from "react";
import type { SessionUser } from "../lib/auth";
import { createAppPath, FRIENDS_SERVER_ID, type AppRoute } from "./routing";
import { useAppServers } from "./useAppServers";

type ServersSidebarProps = {
  activeUser: SessionUser;
  sessionToken: string;
  route: Extract<AppRoute, { kind: "app"; section: "chat" }>;
  navigate: (path: string, options?: { replace?: boolean }) => void;
};

export function ServersSidebar({
  activeUser,
  sessionToken,
  route,
  navigate,
}: ServersSidebarProps) {
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

  return (
    <aside
      aria-label="Servers"
      className="border-b border-slate-800 bg-slate-950 p-3 lg:border-r lg:border-b-0"
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
  );
}
