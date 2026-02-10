import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  getSessionUserQuery,
  loginMutation,
  logoutMutation,
  registerMutation,
  SESSION_TOKEN_STORAGE_KEY,
  type SessionUser,
} from "./lib/auth";
import { AppShell } from "./app/AppShell";
import { AuthPage } from "./app/AuthPage";
import { APP_PATH, LOGIN_PATH, parseRoute, type AppRoute } from "./app/routing";

function readInitialSessionToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  return token && token.length > 0 ? token : null;
}

function App() {
  const [pathname, setPathname] = useState(() =>
    typeof window === "undefined" ? LOGIN_PATH : window.location.pathname,
  );
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(
    readInitialSessionToken,
  );
  const [freshUser, setFreshUser] = useState<SessionUser | null>(null);

  const register = useMutation(registerMutation);
  const login = useMutation(loginMutation);
  const logout = useMutation(logoutMutation);

  const route = useMemo(() => parseRoute(pathname), [pathname]);
  const sessionUser = useQuery(
    getSessionUserQuery,
    sessionToken ? { sessionToken } : "skip",
  );
  const activeUser = useMemo(
    () => (sessionUser === undefined ? freshUser : sessionUser),
    [freshUser, sessionUser],
  );
  const isAuthPage = route.kind === "login" || route.kind === "register";

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

  function persistSession(nextSessionToken: string) {
    setSessionToken(nextSessionToken);
    window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, nextSessionToken);
  }

  function clearLocalSession() {
    setFreshUser(null);
    setSessionToken(null);
    window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    navigate(LOGIN_PATH, { replace: true });
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await register({ loginName, password });
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
      const result = await login({ loginName, password });
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
      } catch {
        // no-op: local cleanup still executes
      }
    }

    clearLocalSession();
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

    clearLocalSession();
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {activeUser && route.kind === "app" && sessionToken ? (
        <AppShell
          activeUser={activeUser}
          sessionToken={sessionToken}
          route={route as Extract<AppRoute, { kind: "app" }>}
          navigate={navigate}
          onLogout={() => {
            void handleLogout();
          }}
        />
      ) : isAuthPage ? (
        <AuthPage
          route={route as Extract<AppRoute, { kind: "login" | "register" }>}
          loginName={loginName}
          password={password}
          errorMessage={errorMessage}
          isSubmitting={isSubmitting}
          onLoginNameChange={setLoginName}
          onPasswordChange={setPassword}
          onSubmit={
            route.kind === "login" ? handleLoginSubmit : handleRegisterSubmit
          }
          onSwitchAuthMode={(path) => {
            setErrorMessage(null);
            navigate(path);
          }}
        />
      ) : null}
    </main>
  );
}

export default App;
