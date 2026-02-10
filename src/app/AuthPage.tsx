import type { FormEvent } from "react";
import { LOGIN_PATH, REGISTER_PATH, type AppRoute } from "./routing";
import { SOCIAL_AUTH_PROVIDERS } from "../lib/auth";

type AuthPageProps = {
  route: Extract<AppRoute, { kind: "login" | "register" }>;
  loginName: string;
  password: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onLoginNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSwitchAuthMode: (path: string) => void;
};

export function AuthPage({
  route,
  loginName,
  password,
  errorMessage,
  isSubmitting,
  onLoginNameChange,
  onPasswordChange,
  onSubmit,
  onSwitchAuthMode,
}: AuthPageProps) {
  return (
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

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">
            Login name
          </span>
          <input
            type="text"
            name="loginName"
            autoComplete="username"
            value={loginName}
            onChange={(event) => onLoginNameChange(event.target.value)}
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
            onChange={(event) => onPasswordChange(event.target.value)}
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
          onClick={() =>
            onSwitchAuthMode(
              route.kind === "login" ? REGISTER_PATH : LOGIN_PATH,
            )
          }
          className="font-medium text-cyan-200 underline-offset-2 hover:underline"
        >
          {route.kind === "login" ? "Register" : "Login"}
        </button>
      </p>
    </section>
  );
}
