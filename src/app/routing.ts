export type AppRoute =
  | { kind: "login" }
  | { kind: "register" }
  | {
      kind: "app";
      section: "chat";
      serverId: string | null;
      channelId: string | null;
    }
  | {
      kind: "app";
      section: "friends";
    }
  | {
      kind: "app";
      section: "settings";
      serverId: string | null;
    };

export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";
export const APP_PATH = "/app";
export const FRIENDS_PATH = `${APP_PATH}/friends`;
export const SETTINGS_PATH = `${APP_PATH}/settings`;
export const FRIENDS_SERVER_ID = "friends";

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

export function parseRoute(pathname: string): AppRoute {
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
    return { kind: "app", section: "chat", serverId: null, channelId: null };
  }

  if (parts.length === 2 && parts[1] === "friends") {
    return { kind: "app", section: "friends" };
  }

  if (parts.length === 2 && parts[1] === "settings") {
    return { kind: "app", section: "settings", serverId: null };
  }

  if (parts.length === 4 && parts[1] === "settings" && parts[2] === "servers") {
    return {
      kind: "app",
      section: "settings",
      serverId: safeDecodePathSegment(parts[3]),
    };
  }

  if (parts.length === 3 && parts[1] === "servers") {
    return {
      kind: "app",
      section: "chat",
      serverId: safeDecodePathSegment(parts[2]),
      channelId: null,
    };
  }

  if (parts.length === 5 && parts[1] === "servers" && parts[3] === "channels") {
    return {
      kind: "app",
      section: "chat",
      serverId: safeDecodePathSegment(parts[2]),
      channelId: safeDecodePathSegment(parts[4]),
    };
  }

  return { kind: "app", section: "chat", serverId: null, channelId: null };
}

export function createAppPath(
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

export function createSettingsPath(serverId: string | null = null): string {
  if (!serverId) {
    return SETTINGS_PATH;
  }

  return `${SETTINGS_PATH}/servers/${encodeURIComponent(serverId)}`;
}

export function createFriendsPath(): string {
  return FRIENDS_PATH;
}
