import type { SessionUser } from "../lib/auth";
import {
  APP_PATH,
  createFriendsPath,
  createSettingsPath,
  type AppRoute,
} from "./routing";
import { AppHeader } from "./AppHeader";
import { ChannelsPanel } from "./ChannelsPanel";
import { FriendsPage } from "./FriendsPage";
import { MessagesPanel } from "./MessagesPanel";
import { SettingsPage } from "./SettingsPage";
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
  const isSettingsRoute = route.section === "settings";
  const isFriendsRoute = route.section === "friends";

  return (
    <div className="flex min-h-screen w-full flex-col">
      <AppHeader
        loginName={activeUser.loginName}
        activeSection={route.section}
        onOpenFriends={() => navigate(createFriendsPath())}
        onOpenSettings={() => navigate(createSettingsPath())}
        onOpenChat={() => navigate(APP_PATH)}
        onLogout={onLogout}
      />

      {isSettingsRoute ? (
        <SettingsPage
          activeUser={activeUser}
          sessionToken={sessionToken}
          route={route}
          navigate={navigate}
        />
      ) : isFriendsRoute ? (
        <FriendsPage
          activeUser={activeUser}
          sessionToken={sessionToken}
          route={route}
        />
      ) : (
        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[5.5rem_20rem_minmax(0,1fr)]">
          <ServersSidebar
            activeUser={activeUser}
            sessionToken={sessionToken}
            route={route}
            navigate={navigate}
          />
          <ChannelsPanel
            activeUser={activeUser}
            sessionToken={sessionToken}
            route={route}
            navigate={navigate}
          />
          <MessagesPanel
            activeUser={activeUser}
            sessionToken={sessionToken}
            route={route}
          />
        </div>
      )}
    </div>
  );
}
