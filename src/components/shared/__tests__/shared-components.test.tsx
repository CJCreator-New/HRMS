// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ErrorBanner } from "../ErrorBanner";
import { EmptyState } from "../EmptyState";
import { PageLoading } from "../PageLoading";

describe("ErrorBanner", () => {
  it("renders the default title and the message inside an alert", () => {
    render(<ErrorBanner message="Something broke" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Error Encountered");
    expect(alert).toHaveTextContent("Something broke");
  });

  it("renders a custom title", () => {
    render(<ErrorBanner title="Sync Failed" message="Retry later" />);
    expect(screen.getByText("Sync Failed")).toBeInTheDocument();
  });

  it("calls onRetry when the retry button is clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorBanner message="Boom" onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the retry button when no handler is provided", () => {
    render(<ErrorBanner message="Boom" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(<EmptyState title="No records" description="Create your first record." />);
    expect(screen.getByRole("heading", { name: "No records" })).toBeInTheDocument();
    expect(screen.getByText("Create your first record.")).toBeInTheDocument();
  });

  it("fires onAction from the action button", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState title="Empty" actionLabel="Add" onAction={onAction} />
    );
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders no button without an action handler", () => {
    render(<EmptyState title="Empty" actionLabel="Add" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("PageLoading", () => {
  it("announces a status region with the message", () => {
    render(<PageLoading message="Crunching numbers..." />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Crunching numbers...");
  });

  it("uses the default loading message", () => {
    render(<PageLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading data...");
  });
});

describe("DataTableSkeleton", () => {
  it("renders table skeleton with specified rows", async () => {
    const { DataTableSkeleton } = await import("../Skeleton");
    render(<DataTableSkeleton rows={4} columns={3} />);
    expect(screen.getByTestId("data-table-skeleton")).toBeInTheDocument();
  });
});
