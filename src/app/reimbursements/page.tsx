"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Receipt, Plus, Shield } from "lucide-react";
import { getReimbursementDataAction, approveReimbursementAction } from "@/lib/actions/data";
import { submitReimbursementClaimAction } from "@/lib/actions/reimbursements";
import { useToast } from "@/components/shared/Toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatCurrencyIndian, formatDateIndian } from "@/lib/utils/formatters";

interface Category {
  id: string;
  code: string;
  name: string;
  max_limit: number;
  duplicate_policy: "block" | "warn_and_allow" | "allow_always";
  approval_route: "manager_only" | "manager_then_hr";
  is_taxable: boolean;
}

interface ReimbursementClaim {
  id: string;
  employee_name: string;
  category_name: string;
  claim_date: string;
  vendor_name: string;
  requested_amount: number;
  approved_amount?: number;
  is_duplicate_warning: boolean;
  is_taxable: boolean;
  status: "submitted" | "pending_manager" | "pending_hr" | "approved" | "rejected" | "paid";
  receipt_name?: string;
}

export default function ReimbursementsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [claims, setClaims] = useState<ReimbursementClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const { toast } = useToast();

  const [catId, setCatId] = useState("");
  const [claimDate, setClaimDate] = useState(new Date().toISOString().split("T")[0]);
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState(0);

  const loadData = async () => {
    setLoading(true);
    const res = await getReimbursementDataAction();
    setEmployeeId((res as any).employeeId || null);
    const rawCats: any[] = (res as any).categories || [];
    setCategories(rawCats.map((c: any) => ({
      id: c.id, code: c.code, name: c.name,
      max_limit: c.max_limit || 0,
      duplicate_policy: c.duplicate_policy || "warn_and_allow",
      approval_route: c.approval_route || "manager_only",
      is_taxable: c.is_taxable || false,
    })));
    if (rawCats.length > 0) setCatId(rawCats[0].id);
    const rawClaims: any[] = (res as any).claims || [];
    setClaims(rawClaims.map((c: any) => ({
      id: c.id,
      employee_name: c.employees?.full_name || "Me",
      category_name: c.reimbursement_categories?.name || "Expense",
      claim_date: c.claim_date,
      vendor_name: c.vendor_name,
      requested_amount: c.requested_amount,
      approved_amount: c.approved_amount,
      is_duplicate_warning: c.is_duplicate_warning || false,
      is_taxable: c.reimbursement_categories?.is_taxable || false,
      status: c.status,
      receipt_name: c.receipt_path?.split("/").pop() || undefined,
    })));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) { toast("Employee record not found.", "error"); return; }
    const res = await submitReimbursementClaimAction(employeeId, catId, claimDate, vendor, amount);
    if (res.error) {
      toast(`Error: ${res.error}`, "error");
    } else {
      setVendor("");
      toast(
        <span>
          Expense Claim submitted for {formatCurrencyIndian(amount)}! Duplicate check applied per category policy.{" "}
          <Link href="/approvals" className="underline font-bold">Track in Approvals →</Link>
        </span>
      );
      await loadData();
    }
  };

  const handleDecideClaim = async (id: string, status: "approved" | "rejected") => {
    const claim = claims.find((c) => c.id === id);
    const res = await approveReimbursementAction(id, status, claim?.requested_amount);
    if (res.error) {
      toast(`Error: ${res.error}`, "error");
    } else {
      toast(
        <span>
          Reimbursement Claim {status}! Will populate into payroll earnings.{" "}
          <Link href="/approvals" className="underline font-bold">Review remaining approvals →</Link>
        </span>
      );
      await loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* PageHeader (WS-B shared component) */}
      <PageHeader
        icon={<Receipt className="w-5 h-5 text-emerald-600" aria-hidden="true" />}
        title="Expense Reimbursements Engine"
        description="Category duplicate policies, approval routing (manager_only | manager_then_hr), and category is_taxable payroll inclusion."
      />

      {/* Categories Banner */}
      <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-3">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-2">
          <Shield className="w-4 h-4 text-emerald-600" /> Expense Categories Policy Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {categories.length === 0 ? (
            <EmptyState title="No categories" description="No expense categories configured." />
          ) : (
            categories.map((c) => (
              <div key={c.id} className="p-4 bg-surface-muted rounded-lg border border-line space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">{c.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.is_taxable ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
                    {c.is_taxable ? "Taxable Earning" : "Non-Taxable"}
                  </span>
                </div>
                <p className="text-[11px] text-ink-secondary">Max Limit: <strong className="text-ink">{formatCurrencyIndian(c.max_limit)}</strong></p>
                <p className="text-[11px] text-ink-secondary">Duplicate Policy: <strong className="text-ink">{c.duplicate_policy}</strong></p>
                <p className="text-[11px] text-ink-secondary">Route: <strong className="text-ink">{c.approval_route}</strong></p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Submit Claim Form & Claims Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submit Form */}
        <div className="bg-surface p-6 rounded-xl border border-line shadow-card space-y-4">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
            <Plus className="w-4 h-4 text-emerald-600" /> Submit Expense Claim
          </h3>

          <form onSubmit={handleSubmitClaim} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-ink-secondary mb-1">Expense Category *</label>
              <select value={catId} onChange={(e) => setCatId(e.target.value)} className="w-full border border-line-strong rounded-lg px-3 py-2 bg-surface font-medium">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.is_taxable ? "Taxable" : "Non-Taxable"})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-ink-secondary mb-1">Expense Date *</label>
              <input type="date" required value={claimDate} onChange={(e) => setClaimDate(e.target.value)} className="w-full border border-line-strong rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold text-ink-secondary mb-1">Vendor Name *</label>
              <input type="text" required value={vendor} onChange={(e) => setVendor(e.target.value)} className="w-full border border-line-strong rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold text-ink-secondary mb-1">Claim Amount (INR) *</label>
              <input type="number" required value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono" />
            </div>
            <button type="submit" className="w-full py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition mt-2">
              Submit Claim for Approval
            </button>
          </form>
        </div>

        {/* Claims Approval Table */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-line shadow-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-ink border-b border-line pb-3">
            Reimbursement Claims Approval Queue
          </h3>

          {loading ? (
            <div className="p-8 text-center text-ink-muted text-xs">Loading claims...</div>
          ) : claims.length === 0 ? (
            <EmptyState title="No reimbursement claims" description="Claims will appear here after submission." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-muted border-b border-line font-bold uppercase text-ink-muted text-[11px]">
                    <th className="px-4 py-2.5">Employee & Category</th>
                    <th className="px-4 py-2.5">Amount & Date</th>
                    <th className="px-4 py-2.5">Payroll Mode</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {claims.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-ink">{c.employee_name}</p>
                        <p className="text-[11px] text-ink-muted">{c.category_name} &bull; {c.vendor_name}</p>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-ink">
                        {formatCurrencyIndian(c.requested_amount)}
                        <p className="text-[10px] text-ink-muted font-normal">{formatDateIndian(c.claim_date)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.is_taxable ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
                          {c.is_taxable ? "Taxable Earning" : "Non-Taxable"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} label={c.status.replace("_", " ")} />
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {c.status.startsWith("pending") ? (
                          <>
                            <button onClick={() => handleDecideClaim(c.id, "approved")} className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700">Approve</button>
                            <button onClick={() => handleDecideClaim(c.id, "rejected")} className="px-2.5 py-1 bg-red-600 text-white rounded text-[11px] font-semibold hover:bg-red-700">Reject</button>
                          </>
                        ) : (
                          <span className="text-ink-faint">Decided</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
