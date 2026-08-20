/**
 * Auth Diagnostic Utility
 * 
 * Captures and logs fetch headers, request timing, client origin, Supabase API URL,
 * and underlying browser-level network/CORS error events during authentication.
 */

export interface AuthDiagnosticContext {
  clientOrigin: string;
  clientUrl: string;
  supabaseUrl: string;
  isOnline: boolean;
  timestamp: string;
}

export interface AuthRequestTiming {
  startTime: number;
  endTime: number;
  durationMs: number;
}

export interface AuthDiagnosticReport {
  context: AuthDiagnosticContext;
  timing: AuthRequestTiming;
  requestHeaders: Record<string, string>;
  errorClassification: "NONE" | "CORS_BLOCKED" | "NETWORK_OFFLINE_OR_DROPPED" | "CONFIG_MISMATCH" | "SERVER_REJECTED_PROMISE" | "AUTH_INVALID_CREDENTIALS" | "AUTH_GENERAL_ERROR";
  summary: string;
  details: Record<string, any>;
}

/**
 * Retrieves client environment context including window.location.origin and configured Supabase endpoint
 */
export function getAuthDiagnosticContext(): AuthDiagnosticContext {
  const isBrowser = typeof window !== "undefined";
  const clientOrigin = isBrowser ? window.location.origin : "server-environment";
  const clientUrl = isBrowser ? window.location.href : "server-environment";
  const isOnline = isBrowser && typeof navigator !== "undefined" ? navigator.onLine : true;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";

  return {
    clientOrigin,
    clientUrl,
    supabaseUrl,
    isOnline,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Captures default request headers expected for Supabase Auth communication
 */
export function getCapturedAuthHeaders(customHeaders?: Record<string, string>): Record<string, string> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
  const baseHeaders: Record<string, string> = {
    "apikey": anonKey ? `${anonKey.slice(0, 10)}...[REDACTED]` : "[NOT_SET]",
    "Content-Type": "application/json",
    "X-Client-Info": "supabase-ssr-hrms/1.0",
    "Accept": "application/json",
    ...customHeaders,
  };
  return baseHeaders;
}

/**
 * Classifies an authentication error into network, CORS, configuration, or server rejection categories
 */
export function classifyAuthError(
  err: any,
  context: AuthDiagnosticContext,
  durationMs: number
): {
  type: AuthDiagnosticReport["errorClassification"];
  summary: string;
  diagnosticAdvice: string;
} {
  const errMsg = (err?.message || (typeof err === "string" ? err : "")).toLowerCase();
  const errCode = (err?.code || (err as any)?.errorCode || "").toLowerCase();
  const status = (err as any)?.status;

  // Check if browser is offline
  if (!context.isOnline) {
    return {
      type: "NETWORK_OFFLINE_OR_DROPPED",
      summary: "Browser network state is offline.",
      diagnosticAdvice: "Check internet connection or DNS reachability.",
    };
  }

  // Check for placeholder or invalid configuration
  if (!context.supabaseUrl || context.supabaseUrl.includes("placeholder") || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return {
      type: "CONFIG_MISMATCH",
      summary: "Supabase endpoint is using placeholder or unset environment variable.",
      diagnosticAdvice: "Ensure NEXT_PUBLIC_SUPABASE_URL is properly configured in environment settings.",
    };
  }

  // Check for CORS policy rejection
  // In browsers, CORS preflight rejections manifest as TypeError: Failed to fetch without HTTP status or status === 0
  const isTypeError = err?.name === "TypeError" || errMsg.includes("typeerror");
  const isFailedToFetch = errMsg.includes("failed to fetch") || errMsg.includes("networkerror") || errMsg.includes("cross-origin");
  const hasNoStatus = status === undefined || status === 0 || status === null;

  if ((isTypeError && isFailedToFetch && hasNoStatus) || errMsg.includes("cors") || errMsg.includes("access-control-allow-origin")) {
    return {
      type: "CORS_BLOCKED",
      summary: `CORS Policy Block: Request from origin "${context.clientOrigin}" was blocked before completing to "${context.supabaseUrl}".`,
      diagnosticAdvice: `Add "${context.clientOrigin}" to the allowed Web Origins in Supabase dashboard (Authentication -> URL Configuration) or verify Content-Security-Policy connect-src.`,
    };
  }

  // Check for invalid credentials
  if (errMsg.includes("invalid login credentials") || errMsg.includes("invalid_grant") || errMsg.includes("user not found") || errCode === "invalid_credentials") {
    return {
      type: "AUTH_INVALID_CREDENTIALS",
      summary: "Server rejected credentials (password mismatch or user not found).",
      diagnosticAdvice: "Verify email and password or use the demo credentials.",
    };
  }

  // Check for server-side promise rejection
  if (status >= 400 || err?.name === "AuthApiError" || errCode.length > 0) {
    return {
      type: "SERVER_REJECTED_PROMISE",
      summary: `Server returned rejected promise / HTTP status ${status ?? "N/A"} (${errCode || "API_ERROR"}).`,
      diagnosticAdvice: "Check server logs or Supabase Auth service status.",
    };
  }

  return {
    type: "AUTH_GENERAL_ERROR",
    summary: errMsg || "Unknown authentication error occurred.",
    diagnosticAdvice: "Inspect raw error details in console.",
  };
}

/**
 * Intercepted fetch log record
 */
export interface InterceptedFetchEvent {
  id: string;
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  requestBody: any;
  status: number;
  statusText: string;
  ok: boolean;
  durationMs: number;
  isCorsOrNetworkBlocked: boolean;
  error?: string;
  timestamp: string;
}

let isInterceptorInstalled = false;
let originalFetch: typeof window.fetch | null = null;
const interceptedHistory: InterceptedFetchEvent[] = [];

/**
 * Safely sanitizes request body to prevent leaking raw plaintext secrets in telemetry
 */
function sanitizeRequestBody(body: any): any {
  if (!body) return null;
  try {
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body);
        if (typeof parsed === "object" && parsed !== null) {
          const sanitized = { ...parsed };
          if ("password" in sanitized) sanitized.password = "•••••••• (masked)";
          if ("refresh_token" in sanitized) sanitized.refresh_token = "•••••••• (masked)";
          return sanitized;
        }
      } catch {
        // String is not JSON, check for url-encoded password
        return body.replace(/password=[^&]+/g, "password=••••••••");
      }
      return body;
    }
    if (body instanceof FormData) {
      const entries: Record<string, any> = {};
      body.forEach((val, key) => {
        entries[key] = key.toLowerCase().includes("password") ? "•••••••• (masked)" : val;
      });
      return entries;
    }
    if (typeof body === "object") {
      const copy = { ...body };
      if ("password" in copy) copy.password = "•••••••• (masked)";
      return copy;
    }
  } catch {
    return "[Body Serialization Failed]";
  }
  return body;
}

/**
 * Installs a global window.fetch interceptor on the login page
 * Captures request body content and specific status codes even when CORS blocks response bodies.
 */
export function installFetchDiagnosticsInterceptor(
  onIntercept?: (event: InterceptedFetchEvent) => void
): () => void {
  if (typeof window === "undefined" || isInterceptorInstalled) {
    return () => {};
  }

  originalFetch = window.fetch;
  isInterceptorInstalled = true;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const startTime = performance.now();
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || (typeof input === "object" && "method" in input ? (input as any).method : "GET");
    
    // Extract headers
    const headersRecord: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((val, key) => {
          headersRecord[key] = key.toLowerCase() === "apikey" || key.toLowerCase() === "authorization" ? `${val.slice(0, 10)}...[MASKED]` : val;
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]) => {
          headersRecord[k] = k.toLowerCase() === "apikey" || k.toLowerCase() === "authorization" ? `${v.slice(0, 10)}...[MASKED]` : v;
        });
      } else {
        Object.entries(init.headers).forEach(([k, v]) => {
          headersRecord[k] = k.toLowerCase() === "apikey" || k.toLowerCase() === "authorization" ? `${String(v).slice(0, 10)}...[MASKED]` : String(v);
        });
      }
    }

    const sanitizedBody = sanitizeRequestBody(init?.body);

    try {
      const response = await originalFetch!(input, init);
      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);

      const event: InterceptedFetchEvent = {
        id: `fetch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        url,
        method: method.toUpperCase(),
        requestHeaders: headersRecord,
        requestBody: sanitizedBody,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        durationMs,
        isCorsOrNetworkBlocked: false,
        timestamp: new Date().toISOString(),
      };

      interceptedHistory.push(event);
      if (interceptedHistory.length > 50) interceptedHistory.shift();

      if (onIntercept) onIntercept(event);

      if (!response.ok) {
        console.warn(`[Fetch Diagnostic Interceptor] HTTP ${response.status} ${response.statusText} on ${method.toUpperCase()} ${url}`, {
          url,
          method: method.toUpperCase(),
          status: response.status,
          statusText: response.statusText,
          durationMs,
          requestBody: sanitizedBody,
          requestHeaders: headersRecord,
        });
      }

      return response;
    } catch (fetchError: any) {
      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);
      const errMsg = fetchError?.message || String(fetchError);
      const isCorsOrNetwork =
        fetchError?.name === "TypeError" ||
        errMsg.toLowerCase().includes("failed to fetch") ||
        errMsg.toLowerCase().includes("networkerror") ||
        errMsg.toLowerCase().includes("cors");

      const event: InterceptedFetchEvent = {
        id: `fetch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        url,
        method: method.toUpperCase(),
        requestHeaders: headersRecord,
        requestBody: sanitizedBody,
        status: 0,
        statusText: isCorsOrNetwork ? "CORS_OR_NETWORK_BLOCKED" : "REJECTED",
        ok: false,
        durationMs,
        isCorsOrNetworkBlocked: isCorsOrNetwork,
        error: errMsg,
        timestamp: new Date().toISOString(),
      };

      interceptedHistory.push(event);
      if (interceptedHistory.length > 50) interceptedHistory.shift();

      if (onIntercept) onIntercept(event);

      console.error("[Fetch Diagnostic Interceptor: Request Failure / CORS Block]", {
        url,
        method: method.toUpperCase(),
        requestBody: sanitizedBody,
        requestHeaders: headersRecord,
        statusCode: 0,
        statusText: isCorsOrNetwork ? "CORS_OR_NETWORK_BLOCKED" : "REJECTED",
        isCorsOrNetworkBlocked: isCorsOrNetwork,
        durationMs,
        error: errMsg,
      });

      throw fetchError;
    }
  };

  return () => {
    if (isInterceptorInstalled && originalFetch) {
      window.fetch = originalFetch;
      isInterceptorInstalled = false;
      originalFetch = null;
    }
  };
}

/**
 * Diagnostic logger that outputs structured network & timing telemetry before state update
 */
export function logAuthDiagnostic(report: AuthDiagnosticReport): void {
  if (typeof console === "undefined") return;

  const isError = report.errorClassification !== "NONE";
  const badge = isError ? "❌ [Auth Diagnostic: Failure Analysis]" : "✅ [Auth Diagnostic: Handshake Succeeded]";
  const logMethod = isError ? console.error : console.log;

  try {
    console.groupCollapsed
      ? console.groupCollapsed(badge, `(${report.timing.durationMs}ms) - ${report.summary}`)
      : console.log(badge, `(${report.timing.durationMs}ms) - ${report.summary}`);

    console.log("🌐 Client Origin & Target Endpoint:", {
      clientOrigin: report.context.clientOrigin,
      clientUrl: report.context.clientUrl,
      supabaseUrl: report.context.supabaseUrl,
      isOnline: report.context.isOnline,
      timestamp: report.context.timestamp,
    });

    console.log("⏱️ Request Timing (Start vs Response):", {
      startTime: new Date(report.timing.startTime).toISOString(),
      endTime: new Date(report.timing.endTime).toISOString(),
      latencyMs: report.timing.durationMs,
    });

    console.log("📋 Request Headers (Outbound):", report.requestHeaders);

    console.log("🔍 Classification & Root Cause:", {
      errorType: report.errorClassification,
      summary: report.summary,
      details: report.details,
    });

    if (console.groupEnd) {
      console.groupEnd();
    }
  } catch (e) {
    logMethod(badge, report);
  }
}


