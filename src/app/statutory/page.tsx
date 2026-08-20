"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Edit, CheckCircle2, Scale } from "lucide-react";
import { getStatutoryDataAction } from "@/lib/actions/data";
import { saveStatutoryProfileAction } from "@/lib/actions/statutory";
import { Modal } from "@/components/shared/Modal";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/components/shared/Toast";
import { formatCurrencyIndian } from "@/lib/utils/formatters";

interface StatutoryProfile {
  id: string;
  employee_code: string;
  employee_name: string;
  pan_number: string;
  uan_number: string;
  pf_applicable: boolean;
  esi_applicable: boolean;
  pt_state: string;
  tax_regime: "new_regime" | "old_regime";
  pf_amount: number;
  esi_amount: number;
  pt_amount: number;
  tds_amount: number;
}

export default function StatutoryManagementPage() {
  const [profiles, setProfiles] = useState<StatutoryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<StatutoryProfile | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const res = await getStatutoryDataAction();
      const rawProfiles: any[] = (res as any).profiles || [];
      setProfiles(rawProfiles.map((p: any) => ({
        id: p.id,
        employee_code: p.employees?.employee_code || "",
        employee_name: p.employees?.full_name || "",
        pan_number: p.pan_number || "",
        uan_number: p.uan_number || "",
        pf_applicable: p.pf_applicable ?? p.is_pf_applicable ?? true,
        esi_applicable: p.esi_applicable ?? p.is_esi_applicable ?? true,
        pt_state: p.pt_state || "Karnataka",
        tax_regime: p.tax_regime || "new_regime",
        pf_amount: p.pf_amount || 0,
        esi_amount: p.esi_amount || 0,
        pt_amount: p.pt_amount || 0,
        tds_amount: p.tds_amount || 0,
      })));
      setLoading(false);
    };
    load();
  }, []);

  // Edit form state
  const [pan, setPan] = useState("");
  const [uan, setUan] = useState("");
  const [ptState, setPtState] = useState("Karnataka");
  const [taxRegime, setTaxRegime] = useState<"new_regime" | "old_regime">("new_regime");
  const [pfApplicable, setPfApplicable] = useState(true);
  const [esiApplicable, setEsiApplicable] = useState(true);

  const handleEditProfile = (profile: StatutoryProfile) => {
    setSelectedProfile(profile);
    setPan(profile.pan_number);
    setUan(profile.uan_number);
    setPtState(profile.pt_state);
    setTaxRegime(profile.tax_regime);
    setPfApplicable(profile.pf_applicable);
    setEsiApplicable(profile.esi_applicable);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    const res = await saveStatutoryProfileAction(selectedProfile.id, pan, uan, ptState, taxRegime, pfApplicable, esiApplicable);
    if (res.error) {
      toast(res.error, "error");
    } else {
      setProfiles(
        profiles.map((p) =>
          p.id === selectedProfile.id
            ? { ...p, pan_number: pan, uan_number: uan, pt_state: ptState, tax_regime: taxRegime, pf_applicable: pfApplicable, esi_applicable: esiApplicable }
            : p
        )
      );
      setSelectedProfile(null);
      toast(`Statutory Profile updated for ${selectedProfile.employee_name}!`);
    }
  };

  return (
    <div className="space-y-6">
      {/* PageHeader (WS-B shared component) */}
      <PageHeader
        icon={<Scale className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
        title="India Statutory Payroll Engine FY 2025–26"
        description="Versioned statutory rule container, PF ₹15k wage cap, ESI 0.75%, state PT slabs, and tax regime profiles."
        actions={
          <span className="text-xs font-bold px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full">
            Rule Version: India_Statutory_FY2025_26
          </span>
        }
      />

      {/* Statutory Rules Version Summary Banner */}
      <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-3">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600" /> Active Versioned Statutory Parameters (Effective 01-Apr-2025)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-surface-muted rounded-lg border border-line">
            <p className="font-semibold text-ink-secondary">Provident Fund (PF)</p>
            <p className="font-mono text-sm font-bold text-ink mt-1">12.00%</p>
            <p className="text-[10px] text-ink-muted">Wage Ceiling: ₹15,000 / mo</p>
          </div>
          <div className="p-3 bg-surface-muted rounded-lg border border-line">
            <p className="font-semibold text-ink-secondary">Employees&apos; State Insurance</p>
            <p className="font-mono text-sm font-bold text-ink mt-1">0.75%</p>
            <p className="text-[10px] text-ink-muted">Gross Ceiling: ₹21,000 / mo</p>
          </div>
          <div className="p-3 bg-surface-muted rounded-lg border border-line">
            <p className="font-semibold text-ink-secondary">Professional Tax (PT)</p>
            <p className="font-mono text-sm font-bold text-ink mt-1">State Slabs</p>
            <p className="text-[10px] text-ink-muted">Karnataka ₹200 (&gt;= ₹25k)</p>
          </div>
          <div className="p-3 bg-surface-muted rounded-lg border border-line">
            <p className="font-semibold text-ink-secondary">Income Tax Regimes</p>
            <p className="font-mono text-sm font-bold text-ink mt-1">New / Old</p>
            <p className="text-[10px] text-ink-muted">FY 2025-26 Tax Slabs</p>
          </div>
        </div>
      </div>

      {/* Employee Statutory Profiles Table — shared DataTable */}
      <div className="bg-surface rounded-xl border border-line shadow-card p-6 space-y-4">
        <h3 className="text-sm font-bold text-ink border-b border-line pb-3">
          Employee Statutory Registration Profiles & Monthly Deductions
        </h3>

        {loading ? (
          <div className="p-8 text-center text-ink-muted text-xs">Loading statutory profiles...</div>
        ) : (
          <DataTable
            name="statutory"
            columns={[
              { key: "employee_name", header: "Code / Employee", sortable: true },
              { key: "pan", header: "PAN & UAN" },
              { key: "pt_state", header: "PT State" },
              { key: "tax_regime", header: "Tax Regime" },
              { key: "deductions", header: "Monthly Deductions (PF / ESI / PT / TDS)" },
              { key: "actions", header: "Action", headerClassName: "text-right" },
            ]}
            rows={profiles}
            getSortValue={(p: StatutoryProfile, key) => (key === "employee_name" ? p.employee_name : "")}
            empty={
              <EmptyState
                title="No statutory profiles"
                description="Employee statutory registration profiles will appear here."
              />
            }
            renderRow={(p: StatutoryProfile) => (
              <tr key={p.id} className="hover:bg-surface-muted/50">
                <td className="px-4 py-3">
                  <p className="font-bold text-ink">{p.employee_name}</p>
                  <p className="text-[11px] font-mono text-ink-muted">{p.employee_code}</p>
                </td>
                <td className="px-4 py-3 font-mono text-ink-secondary">
                  <p>PAN: {p.pan_number}</p>
                  <p className="text-[11px] text-ink-muted">UAN: {p.uan_number}</p>
                </td>
                <td className="px-4 py-3 text-ink-secondary font-medium">{p.pt_state}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary-100 text-primary-800">
                    {p.tax_regime.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-ink-secondary text-[11px]">
                  PF: {formatCurrencyIndian(p.pf_amount)} | ESI: {formatCurrencyIndian(p.esi_amount)} | PT: {formatCurrencyIndian(p.pt_amount)} | TDS: {formatCurrencyIndian(p.tds_amount)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleEditProfile(p)}
                    className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-[11px] font-semibold transition inline-flex items-center gap-1"
                  >
                    <Edit className="w-3 h-3" /> Edit Profile
                  </button>
                </td>
              </tr>
            )}
          />
        )}
      </div>

      {/* Edit Profile Modal (shared Modal — focus trap, Escape, scroll lock) */}
      <Modal
        isOpen={!!selectedProfile}
        onClose={() => setSelectedProfile(null)}
        title={selectedProfile ? `Edit Statutory Profile (${selectedProfile.employee_name})` : "Edit Statutory Profile"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-ink-secondary mb-1">PAN Number *</label>
              <input type="text" required value={pan} onChange={(e) => setPan(e.target.value)} className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono uppercase" />
            </div>
            <div>
              <label className="block font-semibold text-ink-secondary mb-1">UAN Number *</label>
              <input type="text" required value={uan} onChange={(e) => setUan(e.target.value)} className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono" />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-ink-secondary mb-1">Professional Tax State *</label>
            <select value={ptState} onChange={(e) => setPtState(e.target.value)} className="w-full border border-line-strong rounded-lg px-3 py-2 bg-surface">
              <option value="Karnataka">Karnataka</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Telangana">Telangana</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-ink-secondary mb-1">Income Tax Regime *</label>
            <select value={taxRegime} onChange={(e) => setTaxRegime(e.target.value as any)} className="w-full border border-line-strong rounded-lg px-3 py-2 bg-surface">
              <option value="new_regime">New Tax Regime (Default)</option>
              <option value="old_regime">Old Tax Regime</option>
            </select>
          </div>
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-1.5 font-semibold text-ink-secondary cursor-pointer">
              <input type="checkbox" checked={pfApplicable} onChange={(e) => setPfApplicable(e.target.checked)} className="rounded border-line-strong text-indigo-600" />
              PF Applicable
            </label>
            <label className="flex items-center gap-1.5 font-semibold text-ink-secondary cursor-pointer">
              <input type="checkbox" checked={esiApplicable} onChange={(e) => setEsiApplicable(e.target.checked)} className="rounded border-line-strong text-indigo-600" />
              ESI Applicable
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setSelectedProfile(null)} className="px-3 py-1.5 text-ink-secondary hover:bg-surface-muted rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Save Statutory Profile</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
