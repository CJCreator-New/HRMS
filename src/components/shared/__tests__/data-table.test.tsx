import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "../DataTable";

interface TestRow {
  id: string;
  name: string;
  department: string;
  salary: number;
}

const mockColumns: DataTableColumn<TestRow>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "department", header: "Department", sortable: false },
  { key: "salary", header: "Salary", sortable: true },
];

const sampleRows: TestRow[] = [
  { id: "1", name: "Charlie", department: "Engineering", salary: 90000 },
  { id: "2", name: "Alice", department: "HR", salary: 60000 },
  { id: "3", name: "Bob", department: "Finance", salary: 75000 },
];

describe("DataTable Component (P1-2)", () => {
  it("renders empty state when rows are empty", () => {
    render(
      <DataTable
        name="test"
        columns={mockColumns}
        rows={[]}
        renderRow={(row) => <tr key={row.id}><td>{row.name}</td></tr>}
      />
    );

    expect(screen.getByText("No records found.")).toBeInTheDocument();
    expect(screen.getByTestId("pagination-page")).toHaveTextContent("Page 1 of 1");
  });

  it("renders rows and headers correctly in client mode", () => {
    render(
      <DataTable
        name="employees"
        columns={mockColumns}
        rows={sampleRows}
        renderRow={(row) => (
          <tr key={row.id}>
            <td>{row.name}</td>
            <td>{row.department}</td>
            <td>{row.salary}</td>
          </tr>
        )}
      />
    );

    expect(screen.getByTestId("employees-table")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("sorts rows ascending and descending on column header click in client mode", () => {
    render(
      <DataTable
        name="employees"
        columns={mockColumns}
        rows={sampleRows}
        renderRow={(row) => (
          <tr key={row.id} data-testid={`row-${row.id}`}>
            <td>{row.name}</td>
          </tr>
        )}
      />
    );

    const sortNameBtn = screen.getByTestId("sort-name");
    
    // Click 1 -> sort ascending ("Alice", "Bob", "Charlie")
    fireEvent.click(sortNameBtn);
    const rowsAsc = screen.getAllByRole("row");
    // Row 0 is header, row 1 should be Alice
    expect(rowsAsc[1]).toHaveTextContent("Alice");
    expect(rowsAsc[2]).toHaveTextContent("Bob");
    expect(rowsAsc[3]).toHaveTextContent("Charlie");

    // Click 2 -> sort descending ("Charlie", "Bob", "Alice")
    fireEvent.click(sortNameBtn);
    const rowsDesc = screen.getAllByRole("row");
    expect(rowsDesc[1]).toHaveTextContent("Charlie");
    expect(rowsDesc[2]).toHaveTextContent("Bob");
    expect(rowsDesc[3]).toHaveTextContent("Alice");
  });

  it("handles pagination next and prev in client mode with custom pageSizeOptions", () => {
    render(
      <DataTable
        name="paged"
        columns={mockColumns}
        rows={sampleRows}
        pageSizeOptions={[1, 2, 5]}
        renderRow={(row) => (
          <tr key={row.id}>
            <td>{row.name}</td>
          </tr>
        )}
      />
    );

    // Initial page with size 1 -> total pages: 3
    expect(screen.getByTestId("pagination-page")).toHaveTextContent("Page 1 of 3");
    expect(screen.getByTestId("pagination-prev")).toBeDisabled();
    expect(screen.getByTestId("pagination-next")).not.toBeDisabled();

    // Click Next
    fireEvent.click(screen.getByTestId("pagination-next"));
    expect(screen.getByTestId("pagination-page")).toHaveTextContent("Page 2 of 3");
    expect(screen.getByTestId("pagination-prev")).not.toBeDisabled();

    // Click Next again
    fireEvent.click(screen.getByTestId("pagination-next"));
    expect(screen.getByTestId("pagination-page")).toHaveTextContent("Page 3 of 3");
    expect(screen.getByTestId("pagination-next")).toBeDisabled();

    // Click Prev
    fireEvent.click(screen.getByTestId("pagination-prev"));
    expect(screen.getByTestId("pagination-page")).toHaveTextContent("Page 2 of 3");
  });

  it("invokes controlled callbacks in server mode", () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    const onSortChange = vi.fn();

    render(
      <DataTable
        name="server-table"
        columns={mockColumns}
        rows={[sampleRows[0]]}
        total={100}
        page={2}
        pageSize={10}
        sortColumn="salary"
        sortDir="asc"
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onSortChange={onSortChange}
        renderRow={(row) => (
          <tr key={row.id}>
            <td>{row.name}</td>
          </tr>
        )}
      />
    );

    expect(screen.getByTestId("pagination-page")).toHaveTextContent("Page 2 of 10");

    // Click Next page
    fireEvent.click(screen.getByTestId("pagination-next"));
    expect(onPageChange).toHaveBeenCalledWith(3);

    // Click Prev page
    fireEvent.click(screen.getByTestId("pagination-prev"));
    expect(onPageChange).toHaveBeenCalledWith(1);

    // Change page size
    const select = screen.getByTestId("pagination-size");
    fireEvent.change(select, { target: { value: "50" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);

    // Click sort on salary -> toggles to desc
    fireEvent.click(screen.getByTestId("sort-salary"));
    expect(onSortChange).toHaveBeenCalledWith("salary", "desc");
  });
});
