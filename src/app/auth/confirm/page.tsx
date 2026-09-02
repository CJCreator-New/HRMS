"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ConfirmEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleConfirmation() {
      try {
        const tokenHash = searchParams.get("token_hash") || searchParams.get("token");
        const type = (searchParams.get("type") as "signup" | "email" | "recovery") || "signup";

        // If redirected with token_hash
        if (tokenHash) {
          const supabase = createClient();
          const { error: verifyErr } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type === "signup" ? "signup" : "email",
          });

          if (verifyErr) {
            setError(verifyErr.message);
            setLoading(false);
            return;
          }
        }

        setConfirmed(true);
        setLoading(false);
        setTimeout(() => {
          router.push("/login?confirmed=true");
        }, 2000);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Confirmation failed.");
        setLoading(false);
      }
    }

    handleConfirmation();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-subtle p-4">
      <div className="max-w-md w-full bg-surface border border-line rounded-2xl p-8 shadow-card space-y-6 text-center">
        {loading ? (
          <div className="space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600 mx-auto" />
            <h1 className="text-lg font-bold text-ink">Verifying Email Address</h1>
            <p className="text-xs text-ink-secondary">
              Please wait while we confirm your email address with the security gateway...
            </p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-ink">Email Confirmation Failed</h1>
            <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-200">
              {error}
            </p>
            <Link
              href="/login"
              className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 transition"
            >
              Return to Sign In
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-ink">Email Confirmed!</h1>
            <p className="text-xs text-ink-secondary">
              Your account email has been verified. Redirecting you to sign in...
            </p>
            <Link
              href="/login?confirmed=true"
              className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
            >
              Continue to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
