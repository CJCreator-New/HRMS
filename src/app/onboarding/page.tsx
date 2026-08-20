"use client";

import React, { useState } from "react";
import Link from "next/link";
import { UserPlus, Key, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { RoleCode } from "@/lib/types";
import { createEmployeeAction } from "@/lib/actions/employees";
import { Stepper } from "@/components/shared/Stepper";

// Guided workflow steps (WS-C §C3) — Identity & Org Assignment → Credentials Review & Confirm.
const ONBOARDING_STEPS = ["Identity & Org Assignment", "Credentials Review & Confirm"];

export default function DirectOnboardingPage() {
  const [step, setStep] = useState(0);
  const [employeeCode, setEmployeeCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfJoining, setDateOfJoining] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [initialPassword, setInitialPassword] = useState("TempPass123!");
  const [selectedRoles, setSelectedRoles] = useState<RoleCode[]>(["employee"]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [nextStep, setNextStep] = useState<{ label: string; href: string } | null>(null);

  const availableRoles: { code: RoleCode; label: string }[] = [
    { code: "employee", label: "Employee" },
    { code: "manager", label: "Manager" },
    { code: "hr", label: "HR Admin" },
    { code: "payroll_admin", label: "Payroll Admin" },
  ];

  const handleRoleToggle = (role: RoleCode) => {
    if (selectedRoles.includes(role)) {
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter((r) => r !== role));
      }
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Step 1 → 2: advance after native required-field validation passes.
    if (step === 0) {
      setStep(1);
      setSuccessMsg("");
      setErrorMsg("");
      return;
    }

    // Step 2: submit the onboarding record (temp-password behavior unchanged, ADR 0001).
    setLoading(true);
    setSuccessMsg("");
    setErrorMsg("");

    const formData = new FormData();
    formData.append("employeeCode", employeeCode);
    formData.append("fullName", fullName);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("dateOfJoining", dateOfJoining);
    formData.append("tempPassword", initialPassword);
    formData.append("roles", JSON.stringify(selectedRoles));

    const res = await createEmployeeAction(formData);

    setLoading(false);

    if (res?.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg(
        `Employee ${fullName} (${employeeCode}) created successfully! Status: Invited. Temporary password generated. Mandatory password reset enforced on first login.`
      );
      // J6: Store next-step link for the success banner
      setNextStep({ label: "Set up salary structure", href: "/salary" });
      setEmployeeCode("");
      setFullName("");
      setEmail("");
      setPhone("");
      setStep(0);
    }
  };

  const selectedRoleLabels = availableRoles
    .filter((r) => selectedRoles.includes(r.code))
    .map((r) => r.label);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-surface p-6 rounded-xl border border-line shadow-card flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary-600" aria-hidden="true" /> Direct Admin Onboarding
          </h2>
          <p className="text-xs text-ink-secondary mt-1">
            Create employee records directly with initial temporary credentials. Mandatory password reset enforced on first sign-in.
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full">
          Status: Invited &rarr; Active
        </span>
      </div>

      {/* Guided Workflow Stepper (FLW-04) */}
      <Stepper
        steps={ONBOARDING_STEPS}
        current={step}
        testId="stepper"
        className="bg-surface p-5 rounded-xl border border-line shadow-card"
      />

      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-start gap-3 text-sm"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">Onboarding Record Created!</p>
            <p className="text-xs mt-1">{successMsg}</p>
            {nextStep && (
              <Link
                href={nextStep.href}
                className="text-xs font-bold text-emerald-700 underline mt-2 inline-flex items-center gap-1 hover:text-emerald-900"
              >
                Next step: {nextStep.label} →
              </Link>
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3 text-sm"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">Onboarding Failed</p>
            <p className="text-xs mt-1">{errorMsg}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface p-6 rounded-xl border border-line shadow-card space-y-5">
        {step === 0 ? (
          <>
            {/* Step 1 — Identity & Org Assignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="empCodeInput" className="block text-xs font-semibold text-ink-secondary mb-1">
                  Employee Code *
                </label>
                <input
                  id="empCodeInput"
                  data-testid="onboarding-emp-code"
                  type="text"
                  required
                  placeholder="e.g. EMP-101"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  className="w-full text-sm border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="fullNameInput" className="block text-xs font-semibold text-ink-secondary mb-1">
                  Full Name *
                </label>
                <input
                  id="fullNameInput"
                  data-testid="onboarding-full-name"
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-sm border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="emailInput" className="block text-xs font-semibold text-ink-secondary mb-1">
                  Work Email *
                </label>
                <input
                  id="emailInput"
                  data-testid="onboarding-email"
                  type="email"
                  required
                  placeholder="rahul@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-sm border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="phoneInput" className="block text-xs font-semibold text-ink-secondary mb-1">
                  Phone Number
                </label>
                <input
                  id="phoneInput"
                  data-testid="onboarding-phone"
                  type="tel"
                  placeholder="+91 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-sm border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="dojInput" className="block text-xs font-semibold text-ink-secondary mb-1">
                  Date of Joining *
                </label>
                <input
                  id="dojInput"
                  data-testid="onboarding-doj"
                  type="date"
                  required
                  value={dateOfJoining}
                  onChange={(e) => setDateOfJoining(e.target.value)}
                  className="w-full text-sm border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Roles Selection */}
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary-600" aria-hidden="true" /> Assign System Roles
              </label>
              <div className="flex flex-wrap gap-2">
                {availableRoles.map((role) => {
                  const isSelected = selectedRoles.includes(role.code);
                  return (
                    <button
                      type="button"
                      key={role.code}
                      aria-pressed={isSelected}
                      onClick={() => handleRoleToggle(role.code)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isSelected
                          ? "bg-primary-600 text-white border-primary-600 shadow-sm"
                          : "bg-surface-muted text-ink-secondary border-line hover:bg-surface-muted"
                      }`}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-line flex justify-end">
              <button
                type="submit"
                data-testid="onboarding-next-btn"
                className="px-5 py-2.5 bg-primary-600 text-white font-semibold text-sm rounded-lg hover:bg-primary-700 transition flex items-center gap-2 shadow-xs"
              >
                Continue to Review <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2 — Credentials Review & Confirm */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-muted rounded-xl p-4 border border-line">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Employee Code</p>
                <p className="font-mono text-sm font-bold text-ink">{employeeCode}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Full Name</p>
                <p className="text-sm font-bold text-ink">{fullName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Work Email</p>
                <p className="text-sm font-semibold text-ink">{email}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Date of Joining</p>
                <p className="text-sm font-semibold text-ink">{dateOfJoining}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary-600" aria-hidden="true" /> Assigned Roles
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedRoleLabels.map((label) => (
                  <span key={label} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="tempPassInput" className="block text-xs font-semibold text-ink-secondary mb-1">
                Initial Temporary Password *
              </label>
              <div className="relative">
                <input
                  id="tempPassInput"
                  data-testid="onboarding-temp-pass"
                  type="text"
                  required
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  className="w-full text-sm border border-line-strong rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-primary-500 focus:outline-none pr-10"
                />
                <Key className="w-4 h-4 text-ink-faint absolute right-3 top-2.5" aria-hidden="true" />
              </div>
            </div>

            <div className="pt-3 border-t border-line flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="px-4 py-2.5 text-ink-secondary hover:bg-surface-muted font-semibold text-sm rounded-lg transition flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Details
              </button>
              <button
                type="submit"
                data-testid="onboarding-confirm-btn"
                disabled={loading}
                className="px-5 py-2.5 bg-primary-600 text-white font-semibold text-sm rounded-lg hover:bg-primary-700 transition flex items-center gap-2 disabled:opacity-50 shadow-xs"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                {loading ? "Creating Onboarding Record..." : "Confirm & Create Employee"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
