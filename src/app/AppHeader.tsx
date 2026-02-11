type AppHeaderProps = {
  loginName: string;
  activeSection: "chat" | "friends" | "settings";
  onOpenFriends: () => void;
  onOpenSettings: () => void;
  onOpenChat: () => void;
  onLogout: () => void;
};

export function AppHeader({
  loginName,
  activeSection,
  onOpenFriends,
  onOpenSettings,
  onOpenChat,
  onLogout,
}: AppHeaderProps) {
  const isChatActive = activeSection === "chat";
  const isFriendsActive = activeSection === "friends";
  const isSettingsActive = activeSection === "settings";

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950 px-4">
      <div className="flex h-full flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">
            VibeCord
          </p>
          <h1 className="text-xl font-semibold text-white">
            Signed in as {loginName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenChat}
            disabled={isChatActive}
            className={`inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition disabled:cursor-default disabled:opacity-100 ${
              isChatActive
                ? "border-cyan-300 bg-cyan-400/20 text-cyan-100"
                : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800"
            }`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={onOpenFriends}
            disabled={isFriendsActive}
            className={`inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition disabled:cursor-default disabled:opacity-100 ${
              isFriendsActive
                ? "border-cyan-300 bg-cyan-400/20 text-cyan-100"
                : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800"
            }`}
          >
            Friends
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            disabled={isSettingsActive}
            className={`inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition disabled:cursor-default disabled:opacity-100 ${
              isSettingsActive
                ? "border-cyan-300 bg-cyan-400/20 text-cyan-100"
                : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800"
            }`}
          >
            Settings
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
