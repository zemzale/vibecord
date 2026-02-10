import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServersSidebar } from "./ServersSidebar";

const mockUseMutation = vi.fn();
const mockUseAppServers = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockUseMutation(),
}));

vi.mock("./useAppServers", () => ({
  useAppServers: () => mockUseAppServers(),
}));

describe("ServersSidebar", () => {
  beforeEach(() => {
    mockUseMutation.mockReset();
    mockUseAppServers.mockReset();
    mockUseMutation.mockReturnValue(vi.fn());
    mockUseAppServers.mockReturnValue({
      appServers: [
        {
          id: "friends",
          name: "Friends",
          ownerId: "user-1",
          createdAt: Number.MAX_SAFE_INTEGER,
          membershipRole: "owner",
        },
      ],
      myServers: [],
      directMessageChannels: [],
    });
  });

  it("closes modal when clicking the overlay and restores trigger focus", async () => {
    render(
      <ServersSidebar
        activeUser={{ id: "user-1", loginName: "alex" }}
        sessionToken="token"
        route={{ kind: "app", serverId: "friends", channelId: null }}
        navigate={vi.fn()}
        onServerChange={vi.fn()}
        setGlobalServerError={vi.fn()}
        globalServerError={null}
      />,
    );

    const trigger = screen.getByTitle("Create or join server");
    fireEvent.click(trigger);

    const modal = screen.getByRole("dialog", { name: "Server actions" });
    const overlay = modal.parentElement;
    expect(overlay).not.toBeNull();

    fireEvent.click(overlay as HTMLElement);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Server actions" }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("keeps modal open when clicking inside modal content", () => {
    render(
      <ServersSidebar
        activeUser={{ id: "user-1", loginName: "alex" }}
        sessionToken="token"
        route={{ kind: "app", serverId: "friends", channelId: null }}
        navigate={vi.fn()}
        onServerChange={vi.fn()}
        setGlobalServerError={vi.fn()}
        globalServerError={null}
      />,
    );

    const [trigger] = screen.getAllByTitle("Create or join server");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByLabelText("Server actions"));

    expect(
      screen.getByRole("dialog", { name: "Server actions" }),
    ).toBeVisible();
  });
});
