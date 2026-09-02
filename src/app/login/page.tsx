"use client";

import React, { useState } from "react";
import { loginAction, requestPasswordResetAction } from "@/lib/actions/auth";
import {
  Lock,
  Mail,
  Shield,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  Activity,
  Globe,
  Server,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getAuthDiagnosticContext,
  getCapturedAuthHeaders,
  classifyAuthError,
  logAuthDiagnostic,
  AuthDiagnosticReport,
} from "@/lib/utils/auth-diagnostics";

type AuthHandshakeStage = "idle" | "initiating" | "dispatching" | "verifying" | "success" | "error";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Authentication Status & Handshake Progress State
  const [authStage, setAuthStage] = useState<AuthHandshakeStage>("idle");
  const [authProgress, setAuthProgress] = useState(0);
  const [authStatusMessage, setAuthStatusMessage] = useState("");
  const [lastDiagnostic, setLastDiagnostic] = useState<AuthDiagnosticReport | null>(null);
  const [showDiagnosticDetails, setShowDiagnosticDetails] = useState(false);

  // Forgot password sub-state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetEmailTouched, setResetEmailTouched] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");

  const [selectedDemoEmail, setSelectedDemoEmail] = useState<string | null>(null);
  const [justFilled, setJustFilled] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmed = searchParams.get("confirmed") === "true";
  const resetSuccessParam = searchParams.get("reset") === "success";

  // Client-side real-time validation checks
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPasswordValid = password.length >= 6;
  const isResetEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim());

  const executeLogin = async (loginEmail: string, loginPassword: string, isRemember: boolean) => {
    setLoading(true);
    setError("");
    setLastDiagnostic(null);
    setShowDiagnosticDetails(false);

    const startTime = performance.now();
    const context = getAuthDiagnosticContext();
    const requestHeaders = getCapturedAuthHeaders();

    // Stage 1: Initiating Handshake & Environment Check
    setAuthStage("initiating");
    setAuthProgress(25);
    setAuthStatusMessage("Initializing environment & packaging credentials...");

    // Diagnostic logging of origin and target endpoint configuration
    console.log("[Auth Diagnostic: Handshake Initiated]", {
      clientOrigin: context.clientOrigin,
      clientUrl: context.clientUrl,
      targetSupabaseUrl: context.supabaseUrl,
      isOnline: context.isOnline,
      timestamp: context.timestamp,
    });

    try {
      // Stage 2: Dispatching Authentication Request & Headers
      setAuthStage("dispatching");
      setAuthProgress(60);
      setAuthStatusMessage(
        `Connecting to auth service (${context.supabaseUrl.replace(/^https?:\/\//, "").split("/")[0] || "endpoint"})...`
      );

      const formData = new FormData();
      formData.set("email", loginEmail);
      formData.set("password", loginPassword);
      formData.set("rememberMe", isRemember ? "true" : "false");

      // Stage 3: Verifying RBAC Session & Security Tokens
      setAuthStage("verifying");
      setAuthProgress(85);
      setAuthStatusMessage("Verifying credentials & RBAC session permissions...");

      const res = await loginAction(formData);
      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);

      if (res?.error) {
        const code = res.errorCode || "AUTH_ERROR";
        const status = res.status;
        const rawError = res.rawError;

        // Classify the error (CORS block vs Network offline vs Server rejection vs Invalid Credentials)
        const classification = classifyAuthError(res, context, durationMs);

        const diagnosticReport: AuthDiagnosticReport = {
          context,
          timing: { startTime, endTime, durationMs },
          requestHeaders,
          errorClassification: classification.type,
          summary: classification.summary,
          details: {
            errorCode: code,
            httpStatus: status ?? "N/A",
            errorMessage: res.error,
            rawError,
            diagnosticAdvice: classification.diagnosticAdvice,
          },
        };

        // Log comprehensive diagnostic report before updating auth error state
        logAuthDiagnostic(diagnosticReport);

        // Explicitly log origin vs backend API domain to assist CORS and configuration mismatch inspection
        console.error("[Auth Diagnostic: Endpoint & Origin Verification]", {
          "window.location.origin": typeof window !== "undefined" ? window.location.origin : context.clientOrigin,
          "targetSupabaseUrl": context.supabaseUrl,
          "isCorsBlocked": classification.type === "CORS_BLOCKED",
          "isServerRejection": classification.type === "SERVER_REJECTED_PROMISE",
          "roundTripDurationMs": `${durationMs}ms`,
          "diagnosticAdvice": classification.diagnosticAdvice,
        });

        setLastDiagnostic(diagnosticReport);
        setAuthStage("error");
        setAuthProgress(100);
        setAuthStatusMessage(classification.summary);
        setError(res.error);
        toast(res.error, "error");
        setLoading(false);
      } else if (res?.success) {
        const successReport: AuthDiagnosticReport = {
          context,
          timing: { startTime, endTime, durationMs },
          requestHeaders,
          errorClassification: "NONE",
          summary: "Authentication handshake succeeded and session established.",
          details: {
            diagnosticMeta: (res.diagnostic as string) || "standard_auth",
          },
        };

        // Log diagnostic success report
        logAuthDiagnostic(successReport);

        console.info("[Auth Diagnostic: Handshake Succeeded]", {
          "window.location.origin": typeof window !== "undefined" ? window.location.origin : context.clientOrigin,
          "targetSupabaseUrl": context.supabaseUrl,
          "latency": `${durationMs}ms`,
        });

        setLastDiagnostic(successReport);
        setAuthStage("success");
        setAuthProgress(100);
        setAuthStatusMessage("Handshake verified. Establishing session...");
        toast("Sign-in successful. Redirecting to workspace...", "success");
        router.refresh();
        // Full location reload guarantees cookie sync across server components and middleware
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/";
      }
    } catch (err: unknown) {
      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);
      const classification = classifyAuthError(err, context, durationMs);

      const diagnosticReport: AuthDiagnosticReport = {
        context,
        timing: { startTime, endTime, durationMs },
        requestHeaders,
        errorClassification: classification.type,
        summary: classification.summary,
        details: {
          errorObject: err,
          diagnosticAdvice: classification.diagnosticAdvice,
        },
      };

      logAuthDiagnostic(diagnosticReport);

      const errMessage = err instanceof Error ? err.message : String(err);

      console.error("[Auth Diagnostic: Uncaught Network Exception]", {
        "window.location.origin": typeof window !== "undefined" ? window.location.origin : context.clientOrigin,
        "targetSupabaseUrl": context.supabaseUrl,
        "classification": classification.type,
        "exceptionMessage": errMessage,
        "duration": `${durationMs}ms`,
      });

      const fallbackMsg = errMessage || "An unexpected error occurred during sign-in. Please try again.";
      setLastDiagnostic(diagnosticReport);
      setAuthStage("error");
      setAuthProgress(100);
      setAuthStatusMessage(classification.summary);
      setError(fallbackMsg);
      toast(fallbackMsg, "error");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);

    if (!isEmailValid) {
      const msg = "Please enter a valid email address.";
      setError(msg);
      toast(msg, "error");
      return;
    }

    if (!isPasswordValid) {
      const msg = "Password must be at least 6 characters.";
      setError(msg);
      toast(msg, "error");
      return;
    }

    await executeLogin(email, password, rememberMe);
  };

  const showDemoAccounts =
    process.env.NEXT_PUBLIC_MOCK_AUTH === "true" ||
    process.env.NODE_ENV !== "production";

  const handleSelectDemoUser = (demoEmail: string, roleName: string, demoPass: string = "Password123!") => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setSelectedDemoEmail(demoEmail);
    setEmailTouched(true);
    setPasswordTouched(true);
    setError("");
    setJustFilled(true);
    setTimeout(() => setJustFilled(false), 2000);
    toast(`Filled ${roleName} credentials`, "info");
  };

  const handleInstantDemoLogin = async (demoEmail: string, demoPass: string = "Password123!") => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setSelectedDemoEmail(demoEmail);
    setEmailTouched(true);
    setPasswordTouched(true);
    setError("");
    await executeLogin(demoEmail, demoPass, rememberMe);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResetEmailTouched(true);

    if (!isResetEmailValid) {
      setResetError("Please enter a valid email address.");
      return;
    }

    setResetLoading(true);
    setResetError("");
    setResetSuccess("");

    try {
      const res = await requestPasswordResetAction(resetEmail);
      if (res?.error) {
        setResetError(res.error);
        toast(res.error, "error");
      } else {
        const msg = res?.message || "Password reset link has been dispatched to your email.";
        setResetSuccess(msg);
        toast(msg, "success");
      }
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : "Failed to submit password reset request.";
      setResetError(errText);
      toast(errText, "error");
    } finally {
      setResetLoading(false);
    }
  };

  const DEMO_PERSONAS = [
    {
      email: "admin@company.com",
      role: "System Admin",
      icon: "👑",
      desc: "Full system config & master controls",
      testId: "demo-admin",
    },
    {
      email: "hradmin@company.com",
      role: "HR Admin",
      icon: "📋",
      desc: "Employee lifecycle & leave approvals",
      testId: "demo-hr",
    },
    {
      email: "payroll@company.com",
      role: "Payroll Admin",
      icon: "💰",
      desc: "Salary revisions & payroll processing",
      testId: "demo-payroll",
    },
    {
      email: "manager.m1@company.com",
      role: "Manager (M1)",
      icon: "👔",
      desc: "Team attendance & approval workflows",
      testId: "demo-manager",
    },
    {
      email: "employee.e1@company.com",
      role: "Standard Employee (E1)",
      icon: "👤",
      desc: "Self-service portal, leaves, payslips",
      testId: "demo-employee",
    },
  ];

  return (
    <div className="min-h-screen bg-primary-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-xl mx-auto flex items-center justify-center font-bold">
            <Shield className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">
            {showForgotPassword ? "Reset Password" : "HRMS Portal Sign In"}
          </h1>
          <p className="text-xs text-ink-muted">
            {showForgotPassword
              ? "Enter your registered email to receive a password reset link"
              : "Sign in with your organizational credentials"}
          </p>
        </div>

        {confirmed && (
          <div
            role="status"
            className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>Your email has been confirmed successfully! Please sign in with your credentials.</span>
          </div>
        )}

        {resetSuccessParam && (
          <div
            role="status"
            className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>Your password has been reset successfully! Please sign in with your new password.</span>
          </div>
        )}

        {/* Forgot Password Flow */}
        {showForgotPassword ? (
          <div className="space-y-4 text-xs">
            {resetError && (
              <div
                role="alert"
                className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>{resetError}</span>
              </div>
            )}

            {resetSuccess && (
              <div
                role="status"
                className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
                <span>{resetSuccess}</span>
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="resetEmailInput" className="block font-semibold text-ink-secondary mb-1">
                  Registered Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" aria-hidden="true" />
                  <input
                    id="resetEmailInput"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      if (resetError) setResetError("");
                    }}
                    onBlur={() => setResetEmailTouched(true)}
                    placeholder="email@company.com"
                    className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none ${
                      resetEmailTouched && !isResetEmailValid
                        ? "border-red-400 bg-red-50/30"
                        : "border-line-strong"
                    }`}
                  />
                </div>
                {resetEmailTouched && !isResetEmailValid && (
                  <p className="mt-1 text-[11px] text-red-600">Please provide a valid email format (e.g. user@company.com).</p>
                )}
              </div>

              <button
                type="submit"
                disabled={resetLoading || (resetEmailTouched && !isResetEmailValid)}
                aria-busy={resetLoading}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg transition disabled:opacity-70 shadow-xs cursor-pointer flex items-center justify-center min-h-[44px]"
              >
                {resetLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
                    <span className="text-xs font-semibold">Sending Reset Link...</span>
                  </span>
                ) : (
                  "Send Password Reset Link"
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetError("");
                    setResetSuccess("");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink font-semibold transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Standard Login Flow */
          <>
            {/* Authentication Handshake Progress & Status Indicator (dev/mock only) */}
            {showDemoAccounts && (loading || authStage !== "idle") && (
              <div
                data-testid="auth-handshake-status"
                className={`p-3.5 rounded-xl border transition-all space-y-2.5 text-xs ${
                  authStage === "error"
                    ? "bg-red-50/70 border-red-200 text-red-900"
                    : authStage === "success"
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                    : "bg-primary-50/60 border-primary-200 text-ink"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Activity
                      className={`w-4 h-4 ${
                        authStage === "error"
                          ? "text-red-600"
                          : authStage === "success"
                          ? "text-emerald-600"
                          : "text-primary-600 animate-pulse"
                      }`}
                      aria-hidden="true"
                    />
                    <span>
                      {authStage === "error"
                        ? "Authentication Handshake Failed"
                        : authStage === "success"
                        ? "Authentication Handshake Succeeded"
                        : "Authentication Status & Handshake"}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                      authStage === "error"
                        ? "bg-red-100 border-red-300 text-red-800"
                        : authStage === "success"
                        ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                        : "bg-primary-100 border-primary-300 text-primary-800"
                    }`}
                  >
                    {authProgress}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-white/80 h-2 rounded-full overflow-hidden border border-line">
                  <div
                    className={`h-full transition-all duration-300 ease-out ${
                      authStage === "error"
                        ? "bg-red-500"
                        : authStage === "success"
                        ? "bg-emerald-500"
                        : "bg-primary-600"
                    }`}
                    style={{ width: `${authProgress}%` }}
                  />
                </div>

                {/* Status Message & Active Handshake Stage */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium truncate pr-2 text-ink-secondary">
                    {authStatusMessage || "Processing credentials..."}
                  </span>
                  {lastDiagnostic && (
                    <span className="shrink-0 flex items-center gap-1 font-mono text-[10px] text-ink-muted">
                      <Clock className="w-3 h-3 inline" />
                      {lastDiagnostic.timing.durationMs}ms
                    </span>
                  )}
                </div>

                {/* Handshake Phase Breakdown */}
                <div className="grid grid-cols-3 gap-1 pt-1 text-[10px]">
                  <div
                    className={`px-1.5 py-1 rounded text-center font-medium border ${
                      authProgress >= 25
                        ? "bg-white border-primary-300 text-primary-800"
                        : "bg-surface-muted/50 border-line text-ink-faint"
                    }`}
                  >
                    1. Origin & Config
                  </div>
                  <div
                    className={`px-1.5 py-1 rounded text-center font-medium border ${
                      authProgress >= 60
                        ? "bg-white border-primary-300 text-primary-800"
                        : "bg-surface-muted/50 border-line text-ink-faint"
                    }`}
                  >
                    2. Auth Dispatch
                  </div>
                  <div
                    className={`px-1.5 py-1 rounded text-center font-medium border ${
                      authProgress >= 85
                        ? authStage === "error"
                          ? "bg-red-100 border-red-300 text-red-800"
                          : "bg-white border-primary-300 text-primary-800"
                        : "bg-surface-muted/50 border-line text-ink-faint"
                    }`}
                  >
                    3. RBAC Session
                  </div>
                </div>

                {/* Collapsible Diagnostic Inspector for CORS / Network / Rejection details */}
                {lastDiagnostic && (
                  <div className="pt-1.5 border-t border-line/60">
                    <button
                      type="button"
                      onClick={() => setShowDiagnosticDetails((prev) => !prev)}
                      className="w-full flex items-center justify-between text-[11px] font-semibold text-primary-700 hover:text-primary-800 transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        <span>Diagnostic Handshake Telemetry</span>
                      </span>
                      {showDiagnosticDetails ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {showDiagnosticDetails && (
                      <div className="mt-2 p-2.5 bg-white rounded-lg border border-line space-y-1.5 font-mono text-[10px] text-ink-secondary">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-ink-muted">Client Origin:</span>
                          <span className="font-semibold text-ink break-all text-right">
                            {lastDiagnostic.context.clientOrigin}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-ink-muted">Supabase URL:</span>
                          <span className="font-semibold text-ink break-all text-right">
                            {lastDiagnostic.context.supabaseUrl}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-ink-muted">Classification:</span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              lastDiagnostic.errorClassification === "NONE"
                                ? "bg-emerald-100 text-emerald-800"
                                : lastDiagnostic.errorClassification === "CORS_BLOCKED"
                                ? "bg-red-100 text-red-800"
                                : "bg-warning-50 text-warning-800"
                            }`}
                          >
                            {lastDiagnostic.errorClassification}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-ink-muted">Latency:</span>
                          <span>{lastDiagnostic.timing.durationMs}ms</span>
                        </div>
                        {typeof lastDiagnostic.details?.diagnosticAdvice === "string" && (
                          <div className="pt-1 text-[10px] text-ink font-sans bg-surface-muted p-1.5 rounded border border-line">
                            <span className="font-bold">Advice: </span>
                            {lastDiagnostic.details.diagnosticAdvice}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && !loading && authStage !== "error" && (
              <div
                role="alert"
                data-testid="login-error"
                className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} method="POST" className="space-y-4 text-xs">
              <div>
                <label htmlFor="emailInput" className="block font-semibold text-ink-secondary mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" aria-hidden="true" />
                  <input
                    id="emailInput"
                    type="email"
                    name="email"
                    data-testid="login-email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="email@company.com"
                    className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all duration-200 ${
                      justFilled
                        ? "ring-2 ring-primary-500 bg-primary-50/30 border-primary-500"
                        : emailTouched && email.length > 0 && !isEmailValid
                        ? "border-red-400 bg-red-50/30"
                        : "border-line-strong"
                    }`}
                  />
                </div>
                {emailTouched && email.length > 0 && !isEmailValid && (
                  <p className="mt-1 text-[11px] text-red-600">Please enter a valid email address.</p>
                )}
              </div>

              <div>
                <label htmlFor="passwordInput" className="block font-semibold text-ink-secondary mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" aria-hidden="true" />
                  <input
                    id="passwordInput"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    data-testid="login-password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    onBlur={() => setPasswordTouched(true)}
                    placeholder="••••••••••••"
                    className={`w-full pl-9 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all duration-200 ${
                      justFilled
                        ? "ring-2 ring-primary-500 bg-primary-50/30 border-primary-500"
                        : passwordTouched && password.length > 0 && !isPasswordValid
                        ? "border-red-400 bg-red-50/30"
                        : "border-line-strong"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-2.5 text-ink-muted hover:text-ink focus:outline-none p-0.5 rounded cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {passwordTouched && password.length > 0 && !isPasswordValid && (
                  <p className="mt-1 text-[11px] text-red-600">Password must be at least 6 characters.</p>
                )}
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-ink-secondary">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    id="rememberMeCheckbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded border-line focus:ring-primary-500 cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setResetEmail(email);
                  }}
                  className="text-xs text-primary-600 hover:text-primary-700 font-semibold hover:underline focus:outline-none cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                data-testid="login-submit"
                disabled={loading}
                aria-busy={loading}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg transition disabled:opacity-80 shadow-xs cursor-pointer flex items-center justify-center min-h-[44px]"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
                    <span className="text-xs font-semibold">Authenticating...</span>
                  </span>
                ) : selectedDemoEmail ? (
                  `Sign In as ${DEMO_PERSONAS.find((p) => p.email === selectedDemoEmail)?.role || "User"}`
                ) : (
                  "Sign In to HRMS"
                )}
              </button>
            </form>

            {showDemoAccounts && (
              <div className="p-3.5 bg-surface-muted rounded-xl border border-line text-[11px] space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-ink">Demo Accounts (Click to Fill & Sign In):</p>
                  <span className="text-[10px] text-ink-muted bg-white px-2 py-0.5 rounded border border-line">
                    Click card to fill • ⚡ for 1-Click
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {DEMO_PERSONAS.map((persona) => {
                    const isSelected = selectedDemoEmail === persona.email;
                    return (
                      <div
                        key={persona.email}
                        data-testid={persona.testId}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                          isSelected
                            ? "bg-primary-50/70 border-primary-500 ring-1 ring-primary-500"
                            : "bg-white border-line hover:border-primary-300 hover:bg-primary-50/30"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectDemoUser(persona.email, persona.role)}
                          className="flex-1 text-left flex items-center gap-2 cursor-pointer"
                        >
                          <span className="text-base">{persona.icon}</span>
                          <div className="leading-tight">
                            <div className="font-semibold text-ink flex items-center gap-1.5">
                              <span>{persona.role}</span>
                              {isSelected && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-primary-600 inline" aria-hidden="true" />
                              )}
                            </div>
                            <div className="text-[10px] text-ink-muted">{persona.email}</div>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => handleSelectDemoUser(persona.email, persona.role)}
                            className="px-2 py-1 bg-surface-muted hover:bg-surface border border-line rounded text-[10px] font-medium text-ink transition cursor-pointer"
                            title="Fill form inputs"
                          >
                            Fill
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleInstantDemoLogin(persona.email)}
                            className="px-2 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            title="Instantly sign in"
                          >
                            ⚡ Sign In
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-ink-muted pt-1 text-center">
                  Demo Password: <code className="text-primary-600 font-mono font-semibold">Password123!</code>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
