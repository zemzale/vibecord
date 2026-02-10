import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, type FormEvent } from "react";
import { listChannelsQuery } from "../lib/channels";
import {
  deleteMessageMutation,
  listMessagesQuery,
  sendMessageMutation,
} from "../lib/messages";
import {
  listDirectMessagesQuery,
  sendDirectMessageMutation,
} from "../lib/friends";
import { FRIENDS_SERVER_ID, type AppRoute } from "./routing";
import { useAppServers } from "./useAppServers";
import type { SessionUser } from "../lib/auth";

type MessagesPanelProps = {
  activeUser: SessionUser;
  sessionToken: string;
  route: Extract<AppRoute, { kind: "app" }>;
};

export function MessagesPanel({
  activeUser,
  sessionToken,
  route,
}: MessagesPanelProps) {
  const [messageContent, setMessageContent] = useState("");
  const [messageErrorMessage, setMessageErrorMessage] = useState<string | null>(
    null,
  );
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null,
  );

  const sendMessage = useMutation(sendMessageMutation);
  const sendDirectMessage = useMutation(sendDirectMessageMutation);
  const deleteMessage = useMutation(deleteMessageMutation);
  const { directMessageChannels } = useAppServers({ activeUser, sessionToken });

  const isFriendsServerSelected = route.serverId === FRIENDS_SERVER_ID;
  const channels = useQuery(
    listChannelsQuery,
    route.serverId && !isFriendsServerSelected
      ? { sessionToken, serverId: route.serverId }
      : "skip",
  );
  const selectedServerChannel = useMemo(
    () => channels?.find((channel) => channel.id === route.channelId) ?? null,
    [channels, route.channelId],
  );
  const selectedDirectMessageChannel = useMemo(
    () =>
      directMessageChannels?.find(
        (channel) => channel.id === route.channelId,
      ) ?? null,
    [directMessageChannels, route.channelId],
  );
  const messages = useQuery(
    isFriendsServerSelected ? listDirectMessagesQuery : listMessagesQuery,
    route.channelId
      ? isFriendsServerSelected
        ? { sessionToken, friendshipId: route.channelId }
        : { sessionToken, channelId: route.channelId }
      : "skip",
  );

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!route.channelId) {
      setMessageErrorMessage("Select a channel before sending a message.");
      return;
    }

    setMessageErrorMessage(null);
    setIsSendingMessage(true);

    try {
      if (isFriendsServerSelected) {
        await sendDirectMessage({
          sessionToken,
          friendshipId: route.channelId,
          content: messageContent,
        });
      } else {
        await sendMessage({
          sessionToken,
          channelId: route.channelId,
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
    setMessageErrorMessage(null);
    setDeletingMessageId(messageId);

    try {
      await deleteMessage({ sessionToken, messageId });
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

  return (
    <section
      aria-label="Messages"
      className="flex min-h-[26rem] flex-col bg-slate-950 p-4 lg:min-h-0"
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
        Messages
      </h2>

      {!route.serverId ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-400">
          Select a server to start chatting.
        </p>
      ) : !route.channelId ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-400">
          {isFriendsServerSelected
            ? "Select a DM channel to read and send messages."
            : "Select a channel to read and send messages."}
        </p>
      ) : (
        <>
          <p className="mt-3 rounded-xl border border-slate-700 bg-slate-900/70 p-2 text-xs text-slate-300">
            {isFriendsServerSelected ? "Direct message with" : "Chatting in"}{" "}
            <span className="font-semibold text-cyan-100">
              {isFriendsServerSelected
                ? (selectedDirectMessageChannel?.friendLoginName ??
                  "Unknown friend")
                : `# ${selectedServerChannel?.name ?? "Unknown channel"}`}
            </span>
          </p>

          {messageErrorMessage ? (
            <p className="mt-3 text-sm text-rose-300">{messageErrorMessage}</p>
          ) : null}

          {messages === undefined ? (
            <p className="mt-3 text-sm text-slate-400">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-400">
              No messages yet. Start the conversation.
            </p>
          ) : (
            <div className="mt-3 flex-1 overflow-y-auto pr-1">
              <ul className="space-y-2">
                {messages.map((message) => (
                  <li
                    key={message.id}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-cyan-100">
                          {message.authorLoginName}
                        </p>
                        <p className="shrink-0 text-[11px] text-slate-400">
                          {new Date(message.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!isFriendsServerSelected && message.canDelete ? (
                        <button
                          type="button"
                          onClick={() => void handleDeleteMessage(message.id)}
                          disabled={deletingMessageId === message.id}
                          className="inline-flex items-center rounded-full border border-rose-300/40 bg-rose-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingMessageId === message.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-slate-200">
                      {message.content}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form
            className="mt-3 border-t border-slate-800 bg-slate-950 pt-3"
            onSubmit={handleSendMessage}
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Message
              </span>
              <textarea
                name="messageContent"
                value={messageContent}
                onChange={(event) => setMessageContent(event.target.value)}
                required
                minLength={1}
                maxLength={2000}
                rows={3}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
                placeholder="Write a message"
              />
            </label>
            <button
              type="submit"
              disabled={isSendingMessage}
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              {isSendingMessage ? "Sending..." : "Send message"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
