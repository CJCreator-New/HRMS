"use client";

import React, { useEffect, useState, useTransition } from "react";
import { User, Phone, MapPin, ShieldAlert, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { getProfileSelfAction, updateProfileSelfAction, type ProfileData } from "@/lib/actions/profile";
import { useToast } from "@/components/shared/Toast";

export default function ProfilePage() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      const res = await getProfileSelfAction();
      if (res.success && res.data) {
        setProfile(res.data);
      } else {
        setErrorMessage(res.error || "Failed to load profile.");
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await updateProfileSelfAction(formData);
      if (res.success) {
        showToast("Profile updated successfully!", "success");
        // Update local state
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                phone: (formData.get("phone") as string) || null,
                personalAddress: (formData.get("personalAddress") as string) || null,
                emergencyContactName: (formData.get("emergencyContactName") as string) || null,
                emergencyContactPhone: (formData.get("emergencyContactPhone") as string) || null,
              }
            : null
        );
      } else {
        setErrorMessage(res.error || "Failed to update profile.");
        showToast(res.error || "Failed to update profile", "error");
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">My Profile</h1>
          <p className="text-sm text-ink-secondary">
            View your enterprise employee details and maintain your personal contact information.
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Active Employee
        </span>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Official Organization Details (Read-only) */}
      <div className="bg-surface rounded-xl border border-line p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-ink flex items-center gap-2 border-b border-line pb-3">
          <User className="w-5 h-5 text-primary-600" />
          Official Employment Records
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="text-xs font-medium text-ink-muted uppercase">Full Name</label>
            <p className="font-semibold text-ink mt-0.5">{profile?.fullName || "—"}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted uppercase">Employee Code</label>
            <p className="font-semibold text-ink mt-0.5">{profile?.employeeCode || "—"}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted uppercase">Work Email</label>
            <p className="font-semibold text-ink mt-0.5">{profile?.email || "—"}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted uppercase">Date of Joining</label>
            <p className="font-semibold text-ink mt-0.5">{profile?.dateOfJoining || "—"}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted uppercase">Employment Status</label>
            <p className="font-semibold text-ink mt-0.5 capitalize">{profile?.status || "—"}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted uppercase">Role Assignment</label>
            <p className="font-semibold text-ink mt-0.5">Enterprise Member</p>
          </div>
        </div>
      </div>

      {/* 2. Self-Service Editable Personal & Emergency Details */}
      <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-line p-6 shadow-sm space-y-6">
        <h2 className="text-base font-semibold text-ink flex items-center gap-2 border-b border-line pb-3">
          <Phone className="w-5 h-5 text-primary-600" />
          Personal Contact Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block text-xs font-semibold text-ink uppercase mb-1">
              Primary Contact Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={profile?.phone || ""}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="personalAddress" className="block text-xs font-semibold text-ink uppercase mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-ink-muted" /> Residential Address
            </label>
            <textarea
              id="personalAddress"
              name="personalAddress"
              rows={2}
              defaultValue={profile?.personalAddress || ""}
              placeholder="Apartment, Street, City, State, Pincode"
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <h3 className="text-sm font-semibold text-ink flex items-center gap-2 pt-2 border-t border-line">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          Emergency Contact Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="emergencyContactName" className="block text-xs font-semibold text-ink uppercase mb-1">
              Emergency Contact Name
            </label>
            <input
              id="emergencyContactName"
              name="emergencyContactName"
              type="text"
              defaultValue={profile?.emergencyContactName || ""}
              placeholder="Spouse / Parent / Next of Kin"
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="emergencyContactPhone" className="block text-xs font-semibold text-ink uppercase mb-1">
              Emergency Contact Phone
            </label>
            <input
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              type="tel"
              defaultValue={profile?.emergencyContactPhone || ""}
              placeholder="+91 98765 43211"
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-line">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 transition focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving Changes...
              </>
            ) : (
              "Save Profile Changes"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
