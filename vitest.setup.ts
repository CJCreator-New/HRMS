import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount rendered trees after every test to keep jsdom state isolated.
afterEach(() => {
  cleanup();
});
