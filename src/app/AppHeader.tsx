type AppHeaderProps = {
  loginName: string;
  onLogout: () => void;
};

export function AppHeader({ loginName, onLogout }: AppHeaderProps) {
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
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
