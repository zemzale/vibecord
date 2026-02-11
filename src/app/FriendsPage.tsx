import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, type FormEvent } from "react";
import {
  listFriendRequestsQuery,
  listFriendsQuery,
  respondToFriendRequestMutation,
  sendFriendRequestMutation,
} from "../lib/friends";
import type { SessionUser } from "../lib/auth";
import type { AppRoute } from "./routing";

type FriendsPageProps = {
  activeUser: SessionUser;
  sessionToken: string;
  route: Extract<AppRoute, { kind: "app"; section: "friends" }>;
};

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function FriendsPage({ activeUser, sessionToken }: FriendsPageProps) {
  const [targetLoginName, setTargetLoginName] = useState("");
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(
    null,
  );
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(
    null,
  );

  const sendFriendRequest = useMutation(sendFriendRequestMutation);
  const respondToFriendRequest = useMutation(respondToFriendRequestMutation);
  const friendRequests = useQuery(listFriendRequestsQuery, { sessionToken });
  const friends = useQuery(listFriendsQuery, { sessionToken });

  const incomingRequests = friendRequests?.incoming ?? [];
  const outgoingRequests = friendRequests?.outgoing ?? [];
  const acceptedFriends = useMemo(
    () => (friends ?? []).filter((friend) => friend.id !== activeUser.id),
    [activeUser.id, friends],
  );

  async function handleSendFriendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormErrorMessage(null);
    setFormSuccessMessage(null);
    setIsSendingRequest(true);

    try {
      const result = await sendFriendRequest({
        sessionToken,
        loginName: targetLoginName,
      });
      setTargetLoginName("");
      setFormSuccessMessage(
        `Friend request sent to ${result.recipientLoginName}.`,
      );
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setFormErrorMessage(error.data);
      } else {
        setFormErrorMessage(
          "Unable to send this friend request right now. Please try again.",
        );
      }
    } finally {
      setIsSendingRequest(false);
    }
  }

  async function handleRespondToRequest(
    requestId: string,
    action: "accept" | "decline",
  ) {
    setFormErrorMessage(null);
    setFormSuccessMessage(null);
    setRespondingRequestId(requestId);

    try {
      await respondToFriendRequest({ sessionToken, requestId, action });
      setFormSuccessMessage(
        action === "accept"
          ? "Friend request accepted."
          : "Friend request declined.",
      );
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setFormErrorMessage(error.data);
      } else {
        setFormErrorMessage(
          "Unable to update this friend request right now. Please try again.",
        );
      }
    } finally {
      setRespondingRequestId(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl p-4 lg:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
        Friends
      </h2>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          Add friend
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Signed in as{" "}
          <span className="font-semibold text-slate-200">
            {activeUser.loginName}
          </span>
        </p>

        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={handleSendFriendRequest}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Friend login name</span>
            <input
              type="text"
              name="friendLoginName"
              value={targetLoginName}
              onChange={(event) => setTargetLoginName(event.target.value)}
              required
              minLength={3}
              maxLength={24}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
              placeholder="Enter login name"
            />
          </label>
          <button
            type="submit"
            disabled={isSendingRequest}
            className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {isSendingRequest ? "Sending..." : "Send request"}
          </button>
        </form>

        {formErrorMessage ? (
          <p className="mt-3 text-sm text-rose-300">{formErrorMessage}</p>
        ) : null}
        {formSuccessMessage ? (
          <p className="mt-3 text-sm text-emerald-300">{formSuccessMessage}</p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Incoming requests
          </p>

          {friendRequests === undefined ? (
            <p className="mt-3 text-sm text-slate-400">Loading requests...</p>
          ) : incomingRequests.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-400">
              No incoming requests.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {incomingRequests.map((request) => {
                const isBusy = respondingRequestId === request.id;

                return (
                  <li
                    key={request.id}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-slate-100">
                      {request.requesterLoginName}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Requested {formatDate(request.createdAt)}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleRespondToRequest(request.id, "accept")
                        }
                        disabled={isBusy}
                        className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleRespondToRequest(request.id, "decline")
                        }
                        disabled={isBusy}
                        className="inline-flex items-center rounded-full border border-rose-300/40 bg-rose-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Outgoing requests
          </p>

          {friendRequests === undefined ? (
            <p className="mt-3 text-sm text-slate-400">Loading requests...</p>
          ) : outgoingRequests.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-400">
              No outgoing requests.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {outgoingRequests.map((request) => (
                <li
                  key={request.id}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-slate-100">
                    {request.recipientLoginName}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Requested {formatDate(request.createdAt)}
                  </p>
                  <p className="mt-2 text-[11px] uppercase tracking-wide text-amber-200">
                    Pending
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Friends
          </p>

          {friends === undefined ? (
            <p className="mt-3 text-sm text-slate-400">Loading friends...</p>
          ) : acceptedFriends.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-400">
              No friends yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {acceptedFriends.map((friend) => (
                <li
                  key={friend.friendshipId}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-slate-100">
                    {friend.loginName}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Friends since {formatDate(friend.since)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
