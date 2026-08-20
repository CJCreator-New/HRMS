"use client";

import React, { useState } from "react";
import { Lock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { updatePasswordAction } from "@/lib/actions/auth";
import { Modal } from "@/components/shared/Modal";

export function ForcePasswordResetModal({ isOpen }: { isOpen: boolean }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.set("newPassword", newPassword);
    const res = await updatePasswordAction(fd);

    setLoading(false);
    if (res?.error) {
      setError(res.error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => undefined}
      title="Mandatory Password Reset"
      closable={false}
      ariaLabel="Mandatory password reset"
      maxWidth="max-w-md"
    >
      <div className="flex items-center gap-3 text-red-600">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center font-bold">
          <ShieldAlert className="w-6 h-6 text-red-600" aria-hidden="true" />
        </div>
        <p className="text-xs text-ink-muted">First-login password update required for account activation</p>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs">
          {error}
        </div>
      )}

      {success ? (
        <div
          role="status"
          aria-live="polite"
          className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>Password updated successfully! Account activated. Reloading portal...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="newPassInput" className="block font-semibold text-ink-secondary mb-1">
              New Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" aria-hidden="true" />
              <input
                id="newPassInput"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full pl-9 pr-3 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassInput" className="block font-semibold text-ink-secondary mb-1">
              Confirm New Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" aria-hidden="true" />
              <input
                id="confirmPassInput"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full pl-9 pr-3 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg transition disabled:opacity-50 shadow-xs"
          >
            {loading ? "Updating Password..." : "Update Password & Activate Account"}
          </button>
        </form>
      )}
    </Modal>
  );
}
