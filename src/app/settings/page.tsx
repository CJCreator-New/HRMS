"use client";

import React, { useState, useEffect } from "react";
import { Settings, ShieldCheck, CheckCircle2, Save, Unlock, Globe, DollarSign, Clock, UserCheck } from "lucide-react";
import { getCompanySettingsAction, updateCompanySettingsAction } from "@/lib/actions/settings";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/Toast";

export default function CompanySettingsPage() {
  const [companyName, setCompanyName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [noticePeriodDays, setNoticePeriodDays] = useState(30);
  const [managerSlaDays, setManagerSlaDays] = useState(2);
  const [alternateHrApproverId, setAlternateHrApproverId] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const { toast } = useToast();

  const hrApproverOptions = [
    { id: "EMP-001", name: "Admin User (HR Admin)" },
    { id: "EMP-005", name: "Sunita Verma (Senior HR Admin)" },
    { id: "SYSTEM_ADMIN", name: "System Admin Fallback" },
  ];

  useEffect(() => {
    const load = async () => {
      const res = await getCompanySettingsAction();
      if (res.settings) {
        const s = res.settings;
        setCompanyName(s.company_name || "");
        setTimezone(s.timezone || "Asia/Kolkata");
        setCurrency(s.currency || "INR");
        setCurrencySymbol(s.currency_symbol || "₹");
        setNoticePeriodDays(s.notice_period_days_default ?? s.notice_period_days ?? 30);
        setManagerSlaDays(s.manager_sla_days || 2);
        setAlternateHrApproverId(s.alternate_hr_approver_id || "");
        setIsConfigured(s.is_configured ?? false);
      }
      setLoadingData(false);
    };
    load();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData();
    fd.set("companyName", companyName);
    fd.set("timezone", timezone);
    fd.set("currency", currency);
    fd.set("currencySymbol", currencySymbol);
    fd.set("alternateHrApproverId", alternateHrApproverId);
    fd.set("managerSlaDays", String(managerSlaDays));
    fd.set("noticePeriodDaysDefault", String(noticePeriodDays));
    const res = await updateCompanySettingsAction(fd);
    setLoading(false);
    if (res.error) {
      toast(res.error, "error");
    } else {
      setIsConfigured(true);
      toast(`Company settings updated! HR alternate approver set to ${alternateHrApproverId}.`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* PageHeader (WS-B shared component) */}
      <PageHeader
        icon={<Settings className="w-5 h-5 text-primary-600" aria-hidden="true" />}
        title="Company Settings & System Policy Configuration"
        description="Configure system parameters, timezone, currency, Manager SLA days, and singular HR alternate routing."
        actions={
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              isConfigured
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {isConfigured ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-emerald-600" /> System Unlocked
              </>
            ) : (
              <>Zero-Seed Gate Locked</>
            )}
          </span>
        }
      />

      <form onSubmit={handleSaveSettings} className="bg-surface p-6 rounded-xl border border-line shadow-card space-y-6">
        {/* Core Identity */}
        <div>
          <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2 border-b border-line pb-2">
            <Globe className="w-4 h-4 text-primary-600" /> Organization Identity & Localizations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-ink-secondary mb-1">Company Name *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-300 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink-secondary mb-1">Primary Timezone *</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 bg-surface focus:ring-2 focus:ring-primary-300 focus:outline-none"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+5:30)</option>
                <option value="America/New_York">America/New_York (EST - UTC-5:00)</option>
                <option value="Europe/London">Europe/London (GMT - UTC+0:00)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-ink-secondary mb-1">Base Currency Code *</label>
              <input
                type="text"
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink-secondary mb-1">Currency Symbol *</label>
              <input
                type="text"
                required
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Workflow & Approval Routing Policy */}
        <div>
          <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2 border-b border-line pb-2">
            <UserCheck className="w-4 h-4 text-primary-600" /> HR Alternate Routing & Manager SLA
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-ink-secondary mb-1">
                Singular Alternate HR Approver *
              </label>
              <select
                value={alternateHrApproverId}
                onChange={(e) => setAlternateHrApproverId(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 bg-surface font-medium"
              >
                {hrApproverOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-ink-muted mt-1">
                Routes HR Admin leave/reimbursement requests to prevent self-approval.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-ink-secondary mb-1">
                Manager Approval SLA (in Days) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="14"
                  required
                  value={managerSlaDays}
                  onChange={(e) => setManagerSlaDays(parseInt(e.target.value) || 1)}
                  className="w-full border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-300 focus:outline-none"
                />
                <Clock className="w-4 h-4 text-ink-faint absolute right-3 top-2.5" />
              </div>
              <p className="text-[11px] text-ink-muted mt-1">
                Configures approval SLA window in days before escalation.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-ink-secondary mb-1">
                Default Employee Notice Period (in Days) *
              </label>
              <input
                type="number"
                min="0"
                max="180"
                required
                value={noticePeriodDays}
                onChange={(e) => setNoticePeriodDays(parseInt(e.target.value) || 0)}
                className="w-full border border-line-strong rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="pt-4 border-t border-line flex justify-end">
          <button
            type="submit"
            disabled={loading || loadingData}
            className="px-6 py-2.5 bg-primary-600 text-white font-semibold text-xs rounded-lg hover:bg-primary-700 transition flex items-center gap-2 shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? "Saving Settings..." : "Save Settings & Unlock System Gate"}
          </button>
        </div>
      </form>
    </div>
  );
}
