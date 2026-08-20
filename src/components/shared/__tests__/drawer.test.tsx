// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Drawer } from "../Drawer";

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Drawer
      isOpen={open}
      onClose={() => {
        setOpen(false);
        onClose();
      }}
      title="Approval Details"
    >
      <p>Detail content</p>
    </Drawer>
  );
}

describe("Drawer", () => {
  it("renders an accessible modal dialog with title and children", () => {
    render(
      <Drawer isOpen onClose={() => {}} title="Approval Details">
        <p>Detail content</p>
      </Drawer>
    );
    expect(screen.getByTestId("drawer")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { name: /Approval Details/ })).toBeInTheDocument();
    expect(screen.getByText("Detail content")).toBeInTheDocument();
  });

  it("returns null when closed", () => {
    render(
      <Drawer isOpen={false} onClose={() => {}} title="Approval Details">
        <p>Detail content</p>
      </Drawer>
    );
    expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    function FocusHarness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Drawer
            isOpen={open}
            onClose={() => {
              setOpen(false);
              onClose();
            }}
            title="Approval Details"
          >
            <p>Detail content</p>
          </Drawer>
        </>
      );
    }

    render(<FocusHarness />);
    await user.click(screen.getByText("Open"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
    // Focus is restored to the trigger that opened the drawer
    expect(screen.getByText("Open")).toHaveFocus();
  });

  it("closes via the close button and via backdrop click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    function BackdropHarness() {
      const [open, setOpen] = useState(true);
      return (
        <Drawer
          isOpen={open}
          onClose={() => {
            setOpen(false);
            onClose();
          }}
          title="Approval Details"
        >
          <p>Detail content</p>
        </Drawer>
      );
    }

    render(<BackdropHarness />);
    await user.click(screen.getByTestId("drawer-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();

    render(<BackdropHarness />);
    // The backdrop is the absolute overlay; clicking it (not the panel) closes.
    const overlay = screen.getByTestId("drawer");
    await act(async () => {
      // simulate a click on the backdrop layer via the overlay root coordinates
      // closest to the edge — the panel occupies the right side, so click left.
      const backdrop = overlay.firstElementChild as HTMLElement;
      backdrop.click();
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders the footer slot", () => {
    render(
      <Drawer isOpen onClose={() => {}} title="Approval Details" footer={<button>Approve</button>}>
        <p>Detail content</p>
      </Drawer>
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });
});
