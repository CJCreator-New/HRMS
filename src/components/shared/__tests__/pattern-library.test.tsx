// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StatusBadge, statusBadgeClass } from "../StatusBadge";
import { PageHeader } from "../PageHeader";
import { Stepper } from "../Stepper";
import { DataTable } from "../DataTable";
import { useServerTable } from "@/lib/hooks/useServerTable";

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

describe("StatusBadge", () => {
  it("classifies statuses into consistent color families", () => {
    expect(statusBadgeClass("active")).toContain("bg-emerald-100");
    expect(statusBadgeClass("approved")).toContain("bg-emerald-100");
    expect(statusBadgeClass("pending")).toContain("bg-amber-100");
    expect(statusBadgeClass("invited")).toContain("bg-amber-100");
    expect(statusBadgeClass("rejected")).toContain("bg-red-100");
    expect(statusBadgeClass("revoked")).toContain("bg-red-100");
    expect(statusBadgeClass("notice_period")).toContain("bg-blue-100");
    expect(statusBadgeClass("some_unknown_state")).toContain("bg-gray-100");
  });

  it("renders the status text and a custom label override", () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText("pending")).toBeInTheDocument();

    render(<StatusBadge status="pending_approval" label="Pending Approval" />);
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PageHeader
// ---------------------------------------------------------------------------

describe("PageHeader", () => {
  it("renders title, description, icon, and actions", () => {
    render(
      <PageHeader
        title="Employee Directory"
        description="Manage profiles."
        icon={<span data-testid="icon" />}
        actions={<button>New</button>}
      />
    );
    expect(screen.getByRole("heading", { name: /Employee Directory/ })).toBeInTheDocument();
    expect(screen.getByText("Manage profiles.")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("applies the testId to the h2 element", () => {
    render(<PageHeader testId="payroll-header" title="Payroll" />);
    expect(screen.getByTestId("payroll-header").tagName).toBe("H2");
  });
});

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

describe("Stepper", () => {
  const steps = ["Draft", "Validate", "Finalize"];

  it("renders the container and all steps with numbered testids and labels", () => {
    render(<Stepper steps={steps} current={1} />);
    expect(screen.getByTestId("stepper")).toBeInTheDocument();
    expect(screen.getByTestId("stepper-step-1")).toBeInTheDocument();
    expect(screen.getByTestId("stepper-step-2")).toBeInTheDocument();
    expect(screen.getByTestId("stepper-step-3")).toBeInTheDocument();
    for (const label of steps) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks the active step with aria-current and completed steps as done", () => {
    render(<Stepper steps={steps} current={1} />);
    const active = screen.getByTestId("stepper-step-2");
    expect(active).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("stepper-step-1")).not.toHaveAttribute("aria-current");
    expect(screen.getByTestId("stepper-step-3")).not.toHaveAttribute("aria-current");
  });

  it("is exposed as a progress navigation landmark", () => {
    render(<Stepper steps={steps} current={0} />);
    expect(screen.getByRole("navigation", { name: "Progress" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DataTable — client-mode pagination + sort
// ---------------------------------------------------------------------------

const TABLE_ROWS = [
  { id: "1", code: "B", name: "Beta" },
  { id: "2", code: "A", name: "Alpha" },
  { id: "3", code: "C", name: "Gamma" },
  { id: "4", code: "D", name: "Delta" },
];

function ClientTable() {
  return (
    <DataTable
      name="test"
      columns={[{ key: "code", header: "Code", sortable: true }]}
      rows={TABLE_ROWS}
      pageSizeOptions={[2, 5, 10]}
      getSortValue={(row: (typeof TABLE_ROWS)[number], key) => row[key as "code"]}
      renderRow={(row) => (
        <tr key={row.id}>
          <td>{row.name}</td>
        </tr>
      )}
    />
  );
}

describe("DataTable (client mode)", () => {
  it("paginates rows and exposes the pagination contract", async () => {
    const user = userEvent.setup();
    render(<ClientTable />);

    expect(screen.getByTestId("test-table")).toBeInTheDocument();
    expect(screen.getByTestId("pagination")).toBeInTheDocument();
    expect(screen.getByTestId("pagination-page")).toHaveTextContent("Page 1 of 2");

    // Default page size 2 → only the first two rows render
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("pagination-next"));
    expect(screen.getByTestId("pagination-page")).toHaveTextContent("Page 2 of 2");
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    expect(screen.getByText("Delta")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("pagination-prev"));
    expect(screen.getByTestId("pagination-page")).toHaveTextContent("Page 1 of 2");
  });

  it("sorts by a column header, toggling aria-sort", async () => {
    const user = userEvent.setup();
    render(<ClientTable />);

    const sortBtn = screen.getByTestId("sort-code");
    await user.click(sortBtn);
    expect(sortBtn).toHaveAttribute("aria-sort", "ascending");
    // Ascending order → Alpha first, resets to page 1
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Alpha");

    await user.click(sortBtn);
    expect(sortBtn).toHaveAttribute("aria-sort", "descending");
    const rowsDesc = screen.getAllByRole("row").slice(1);
    expect(rowsDesc[0]).toHaveTextContent("Delta");
  });

  it("changes the page size via the selector", async () => {
    const user = userEvent.setup();
    render(<ClientTable />);

    await user.selectOptions(screen.getByTestId("pagination-size"), "5");
    expect(screen.getByTestId("pagination-page")).toHaveTextContent("Page 1 of 1");
    expect(screen.getByText("Delta")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DataTable — server-mode controlled props
// ---------------------------------------------------------------------------

describe("DataTable (server mode)", () => {
  it("defers page/sort changes to the parent callbacks", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onSortChange = vi.fn();

    function ServerTable() {
      const [page, setPage] = useState(1);
      const [sort, setSort] = useState<{ column: string; dir: "asc" | "desc" } | null>(null);
      return (
        <DataTable
          name="srv"
          columns={[{ key: "code", header: "Code", sortable: true }]}
          rows={TABLE_ROWS.slice(0, 2)}
          total={4}
          page={page}
          pageSize={2}
          sortColumn={sort?.column ?? null}
          sortDir={sort?.dir ?? null}
          onPageChange={(p) => {
            setPage(p);
            onPageChange(p);
          }}
          onSortChange={(col, dir) => {
            setSort({ column: col, dir });
            onSortChange(col, dir);
          }}
          renderRow={(row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
            </tr>
          )}
        />
      );
    }

    render(<ServerTable />);
    expect(screen.getByTestId("pagination-page")).toHaveTextContent("Page 1 of 2");

    await user.click(screen.getByTestId("pagination-next"));
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getByTestId("pagination-page")).toHaveTextContent("Page 2 of 2");

    await user.click(screen.getByTestId("sort-code"));
    expect(onSortChange).toHaveBeenCalledWith("code", "asc");
    expect(screen.getByTestId("sort-code")).toHaveAttribute("aria-sort", "ascending");
  });

  it("clamps the page when total shrinks below the current page", async () => {
    const user = userEvent.setup();

    function ShrinkingTable() {
      const [page, setPage] = useState(2);
      return (
        <DataTable
          name="shr"
          columns={[{ key: "code", header: "Code" }]}
          rows={TABLE_ROWS.slice(0, 2)}
          total={2}
          page={page}
          pageSize={2}
          onPageChange={setPage}
          renderRow={(row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
            </tr>
          )}
        />
      );
    }

    render(<ShrinkingTable />);
    await act(async () => {});
    expect(screen.getByTestId("pagination-page")).toHaveTextContent("Page 1 of 1");
  });
});

// ---------------------------------------------------------------------------
// useServerTable
// ---------------------------------------------------------------------------

describe("useServerTable", () => {
  it("resets to page 1 when page size, sort, or reset changes", () => {
    const { result } = renderHook(() => useServerTable());

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setPageSize(50));
    expect(result.current.pageSize).toBe(50);
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(2));
    act(() => result.current.setSort("status", "desc"));
    expect(result.current.sortColumn).toBe("status");
    expect(result.current.sortDir).toBe("desc");
    expect(result.current.page).toBe(1);

    act(() => result.current.setTotal(120));
    expect(result.current.total).toBe(120);
  });
});
