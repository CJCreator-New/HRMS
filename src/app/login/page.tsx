"use client";

import React, { useState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { Lock, Mail, Shield, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError("");

    const res = await loginAction(formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else if (res?.success) {
      // Full page reload to reset all client state and re-run middleware
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen bg-primary-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-xl mx-auto flex items-center justify-center font-bold">
            <Shield className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">HRMS Portal Sign In</h1>
          <p className="text-xs text-ink-muted">Sign in with your organizational credentials</p>
        </div>

        {error && (
          <div
            role="alert"
            data-testid="login-error"
            className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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
                defaultValue=""
                placeholder="email@company.com"
                className="w-full pl-9 pr-3 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="passwordInput" className="block font-semibold text-ink-secondary mb-1">
              Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" aria-hidden="true" />
              <input
                id="passwordInput"
                type="password"
                name="password"
                data-testid="login-password"
                required
                defaultValue=""
                className="w-full pl-9 pr-3 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            data-testid="login-submit"
            disabled={loading}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg transition disabled:opacity-50 shadow-xs"
          >
            {loading ? "Signing In..." : "Sign In to HRMS"}
          </button>
        </form>

        <div className="p-3 bg-surface-muted rounded-xl border border-line text-[11px] text-ink-secondary space-y-1">
          <p className="font-bold text-ink">Demo System Access:</p>
          <p>Email: <code className="text-primary-600 font-mono">admin@company.com</code></p>
          <p>Password: <code className="text-primary-600 font-mono">TempAdminPass123!</code></p>
        </div>
      </div>
    </div>
  );
}
