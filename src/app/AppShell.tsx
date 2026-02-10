import { useState } from "react";
import type { SessionUser } from "../lib/auth";
import { type AppRoute } from "./routing";
import { AppHeader } from "./AppHeader";
import { ChannelsPanel } from "./ChannelsPanel";
import { MessagesPanel } from "./MessagesPanel";
import { ServersSidebar } from "./ServersSidebar";

type AppShellProps = {
  activeUser: SessionUser;
  sessionToken: string;
  route: Extract<AppRoute, { kind: "app" }>;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  onLogout: () => void;
};

export function AppShell({
  activeUser,
  sessionToken,
  route,
  navigate,
  onLogout,
}: AppShellProps) {
  const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(
    null,
  );

  function clearErrors() {
    setServerErrorMessage(null);
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <AppHeader loginName={activeUser.loginName} onLogout={onLogout} />

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[5.5rem_20rem_minmax(0,1fr)]">
        <ServersSidebar
          activeUser={activeUser}
          sessionToken={sessionToken}
          route={route}
          navigate={navigate}
          onServerChange={clearErrors}
          setGlobalServerError={setServerErrorMessage}
          globalServerError={serverErrorMessage}
        />
        <ChannelsPanel
          activeUser={activeUser}
          sessionToken={sessionToken}
          route={route}
          navigate={navigate}
          onChannelChange={clearErrors}
        />
        <MessagesPanel
          activeUser={activeUser}
          sessionToken={sessionToken}
          route={route}
        />
      </div>
    </div>
  );
}
