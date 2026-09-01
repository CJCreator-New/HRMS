import { describe, it, expect } from "vitest";
import { toArray } from "../array";

describe("toArray", () => {
  it("returns an empty array for null", () => {
    expect(toArray(null)).toEqual([]);
  });

  it("returns an empty array for undefined", () => {
    expect(toArray(undefined)).toEqual([]);
  });

  it("wraps a single object in an array", () => {
    expect(toArray({ id: 1 })).toEqual([{ id: 1 }]);
  });

  it("returns the same array when already an array", () => {
    const input = [{ id: 1 }, { id: 2 }];
    expect(toArray(input)).toEqual(input);
  });

  it("returns an empty array for an empty array", () => {
    expect(toArray([])).toEqual([]);
  });

  it("preserves the element type", () => {
    const result = toArray<string>("hello");
    expect(result).toEqual(["hello"]);
    expect(result[0]).toBe("hello");
  });

  it("handles arrays with mixed types (as unknown[])", () => {
    const input: unknown[] = [{ id: 1 }, { id: 2 }];
    expect(toArray(input)).toEqual(input);
  });
});
