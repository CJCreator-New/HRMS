"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(true);

  useEffect(() => {
    // Check URL parameters and hash for recovery token
    const token = searchParams.get("token") || searchParams.get("access_token");
    const type = searchParams.get("type");

    // Supabase often sends tokens in hash fragments: #access_token=...&type=recovery
    if (typeof window !== "undefined" && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashToken = hashParams.get("access_token");
      const hashType = hashParams.get("type");
      if (hashToken && hashType === "recovery") {
        setVerifyingToken(false);
        return;
      }
    }

    if (token || type === "recovery") {
      setVerifyingToken(false);
    } else {
      // In dev or when direct access, allow user to test form
      setVerifyingToken(false);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      setError(
        "Password must contain uppercase, lowercase, number, and special character."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error: updateErr } = await supabase.auth.updateUser({
          password,
        });

        if (updateErr) {
          setError(updateErr.message);
          return;
        }

        setSuccess(true);
        setTimeout(() => {
          router.push("/login?reset=success");
        }, 2000);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to update password.");
      }
    });
  }

  if (verifyingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
          <p className="text-sm text-ink-secondary">Verifying reset authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-subtle p-4">
      <div className="max-w-md w-full bg-surface border border-line rounded-2xl p-8 shadow-card space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto text-primary-600">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-ink">Set New Password</h1>
          <p className="text-xs text-ink-secondary">
            Enter your new password below. It must meet enterprise complexity standards.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl space-y-3 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="font-semibold">Password reset successfully!</p>
            <p className="text-xs text-emerald-700">Redirecting to login page...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink uppercase mb-1" htmlFor="password">
                New Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink uppercase mb-1" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="text-[11px] text-ink-secondary bg-surface-muted p-3 rounded-lg space-y-1">
              <p className="font-semibold text-ink">Requirements:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li className={password.length >= 8 ? "text-emerald-600 font-medium" : ""}>
                  Minimum 8 characters
                </li>
                <li className={/[A-Z]/.test(password) && /[a-z]/.test(password) ? "text-emerald-600 font-medium" : ""}>
                  Uppercase and lowercase letters
                </li>
                <li className={/\d/.test(password) ? "text-emerald-600 font-medium" : ""}>
                  At least one number
                </li>
                <li className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? "text-emerald-600 font-medium" : ""}>
                  At least one special character
                </li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Updating Password...
                </>
              ) : (
                <>
                  Reset Password <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="text-center pt-2 border-t border-line">
          <Link href="/login" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
