import { describe, it, expect, vi } from "vitest";
import {
  getAuthDiagnosticContext,
  getCapturedAuthHeaders,
  classifyAuthError,
  logAuthDiagnostic,
  AuthDiagnosticReport,
} from "../auth-diagnostics";

describe("auth-diagnostics utility", () => {
  it("retrieves client environment context", () => {
    const ctx = getAuthDiagnosticContext();
    expect(ctx).toHaveProperty("clientOrigin");
    expect(ctx).toHaveProperty("supabaseUrl");
    expect(ctx).toHaveProperty("isOnline");
    expect(ctx).toHaveProperty("timestamp");
  });

  it("captures redacted request headers for supabase auth", () => {
    const headers = getCapturedAuthHeaders({ "X-Custom-Trace": "trace-123" });
    expect(headers).toHaveProperty("apikey");
    expect(headers).toHaveProperty("Content-Type", "application/json");
    expect(headers).toHaveProperty("X-Custom-Trace", "trace-123");
  });

  it("classifies offline network errors correctly", () => {
    const ctx = {
      clientOrigin: "http://localhost:3000",
      clientUrl: "http://localhost:3000/login",
      supabaseUrl: "https://real-project.supabase.co",
      isOnline: false,
      timestamp: new Date().toISOString(),
    };
    const res = classifyAuthError(new Error("Failed to fetch"), ctx, 20);
    expect(res.type).toBe("NETWORK_OFFLINE_OR_DROPPED");
  });

  it("classifies CORS policy rejections correctly", () => {
    const ctx = {
      clientOrigin: "http://localhost:3000",
      clientUrl: "http://localhost:3000/login",
      supabaseUrl: "https://real-project.supabase.co",
      isOnline: true,
      timestamp: new Date().toISOString(),
    };
    const typeError = new TypeError("Failed to fetch");
    const res = classifyAuthError(typeError, ctx, 15);
    expect(res.type).toBe("CORS_BLOCKED");
    expect(res.summary).toContain("CORS Policy Block");
  });

  it("classifies invalid credentials correctly", () => {
    const ctx = {
      clientOrigin: "http://localhost:3000",
      clientUrl: "http://localhost:3000/login",
      supabaseUrl: "https://real-project.supabase.co",
      isOnline: true,
      timestamp: new Date().toISOString(),
    };
    const err = { message: "Invalid login credentials", status: 400 };
    const res = classifyAuthError(err, ctx, 120);
    expect(res.type).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("logs structured diagnostic report to console without throwing", () => {
    const spyLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const spyError = vi.spyOn(console, "error").mockImplementation(() => {});

    const report: AuthDiagnosticReport = {
      context: getAuthDiagnosticContext(),
      timing: { startTime: Date.now() - 50, endTime: Date.now(), durationMs: 50 },
      requestHeaders: getCapturedAuthHeaders(),
      errorClassification: "NONE",
      summary: "Handshake verified successfully",
      details: {},
    };

    expect(() => logAuthDiagnostic(report)).not.toThrow();

    spyLog.mockRestore();
    spyError.mockRestore();
  });
});
