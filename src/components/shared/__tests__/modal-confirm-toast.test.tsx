// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Modal } from "../Modal";
import { ConfirmDialog } from "../ConfirmDialog";
import { ToastProvider, useToast } from "../Toast";

// ---------------------------------------------------------------------------
// Modal — a11y contract (H-11): focus trap, Escape, backdrop, scroll lock
// ---------------------------------------------------------------------------

describe("Modal", () => {
  it("renders an accessible dialog with the given title and aria attributes", () => {
    render(
      <Modal isOpen onClose={() => {}} title="Record Assignment">
        <p>Modal content</p>
      </Modal>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "modal-title");
    expect(screen.getByRole("heading", { name: /Record Assignment/ })).toBeInTheDocument();
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("returns null when closed", () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden">
        <p>content</p>
      </Modal>
    );
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  it("closes on Escape, on backdrop click, and via the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <Modal
          isOpen={open}
          onClose={() => {
            setOpen(false);
            onClose();
          }}
          title="Dismissible"
        >
          <p>content</p>
        </Modal>
      );
    }

    // Escape
    const { unmount } = render(<Harness />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    // Backdrop click (click the overlay, not the panel)
    const backdrop = vi.fn();
    render(
      <Modal isOpen onClose={backdrop} title="Backdrop">
        <p>content</p>
      </Modal>
    );
    const overlay = screen.getByTestId("modal");
    await act(async () => {
      overlay.click();
    });
    expect(backdrop).toHaveBeenCalledTimes(1);
  });

  it("closes via the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Closable">
        <p>content</p>
      </Modal>
    );
    await user.click(screen.getByTestId("modal-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on backdrop click when closable is false", async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Locked" closable={false}>
        <p>content</p>
      </Modal>
    );
    const overlay = screen.getByTestId("modal");
    await act(async () => {
      overlay.click();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ConfirmDialog — built on Modal, danger variant (H-12)
// ---------------------------------------------------------------------------

describe("ConfirmDialog", () => {
  it("renders title, description and confirm/cancel with data-testids", () => {
    render(
      <ConfirmDialog
        isOpen
        title="Revoke System Access"
        description="This will lock out the employee."
        confirmLabel="Deactivate Employee"
        cancelLabel="Cancel"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Revoke System Access")).toBeInTheDocument();
    expect(screen.getByText("This will lock out the employee.")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-dialog-confirm")).toHaveTextContent("Deactivate Employee");
    expect(screen.getByTestId("confirm-dialog-cancel")).toHaveTextContent("Cancel");
  });

  it("fires onConfirm and onCancel from the buttons", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        title="Confirm"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    await user.click(screen.getByTestId("confirm-dialog-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// ToastProvider / useToast — UX-01: aria-live, auto-dismiss, manual close
// ---------------------------------------------------------------------------

function ToastHarness() {
  const { toast } = useToast();
  return (
    <button onClick={() => toast("Saved successfully!")}>Fire Toast</button>
  );
}

describe("ToastProvider / useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a success toast inside an aria-live region", () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText("Fire Toast"));
    const toast = screen.getByTestId("toast");
    expect(toast).toHaveTextContent("Saved successfully!");
    // Toast stack lives in a polite live region
    expect(document.querySelector("[aria-live='polite']")).toBeInTheDocument();
  });

  it("auto-dismisses after the default timeout", () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText("Fire Toast"));
    expect(screen.getByTestId("toast")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4600);
    });
    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
  });

  it("dismisses manually via the close button", () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText("Fire Toast"));
    expect(screen.getByTestId("toast")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("toast-close"));
    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
  });

  it("throws when useToast is used outside the provider", () => {
    const originalError = console.error;
    console.error = () => {};
    const errorHandler = (e: Event) => e.preventDefault();
    window.addEventListener("error", errorHandler);
    try {
      expect(() => render(<ToastHarness />)).toThrow("useToast must be used within a ToastProvider");
    } finally {
      window.removeEventListener("error", errorHandler);
      console.error = originalError;
    }
  });
});
