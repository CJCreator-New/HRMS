"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Plus, CheckCircle, Clock, Gift, Shield, Upload } from "lucide-react";
import { getCalendarDataAction } from "@/lib/actions/data";
import {
  createHolidayAction,
  selectOptionalHolidayAction,
  bulkAssignCalendarTemplate,
} from "@/lib/actions/calendar";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageLoading } from "@/components/shared/PageLoading";
import { useToast } from "@/components/shared/Toast";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateIndian } from "@/lib/utils/formatters";
import { BatchUploadDrawer } from "@/components/shared/batch-import/BatchUploadDrawer";
import { CalendarAssignmentBatchSchema } from "@/lib/batch-import/schemas";

interface Holiday {
  id: string;
  name: string;
  date: string;
  is_optional: boolean;
}

interface CalendarTemplate {
  id: string;
  code: string;
  name: string;
  standard_working_days: string;
  alt_saturday_rule: string;
  optional_allowed: number;
  deadline_date: string;
  is_default: boolean;
}

const SAMPLE_HOLIDAYS: Holiday[] = [
  { id: "1", name: "Republic Day", date: "2026-01-26", is_optional: false },
  { id: "2", name: "Independence Day", date: "2026-08-15", is_optional: false },
  { id: "3", name: "Gandhi Jayanti", date: "2026-10-02", is_optional: false },
  { id: "4", name: "Diwali (Deepavali)", date: "2026-11-08", is_optional: false },
  { id: "5", name: "Maha Shivaratri", date: "2026-02-15", is_optional: true },
  { id: "6", name: "Holi", date: "2026-03-04", is_optional: true },
  { id: "7", name: "Good Friday", date: "2026-04-03", is_optional: true },
  { id: "8", name: "Eid-ul-Fitr", date: "2026-03-20", is_optional: true },
];

export default function CalendarManagementPage() {
  const [templates, setTemplates] = useState<CalendarTemplate[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultTemplateId, setDefaultTemplateId] = useState("");
  const [selectedOptional, setSelectedOptional] = useState<string[]>([]);
  const [showBatchDrawer, setShowBatchDrawer] = useState(false);
  const { toast } = useToast();

  // Holiday Add Form State
  const [newHolName, setNewHolName] = useState("");
  const [newHolDate, setNewHolDate] = useState("");
  const [newHolIsOpt, setNewHolIsOpt] = useState(false);

  const loadCalendarData = async () => {
    setLoading(true);
    const res = await getCalendarDataAction();
    const rawHols = res.holidays || [];
    setHolidays(
      rawHols.length > 0
        ? rawHols.map((h: { id: string; name: string; holiday_date?: string; date?: string; is_optional?: boolean }) => ({
            id: h.id,
            name: h.name,
            date: h.holiday_date || h.date || "",
            is_optional: Boolean(h.is_optional),
          }))
        : SAMPLE_HOLIDAYS
    );
    const rawTmpls = res.templates || [];
    setTemplates(
      rawTmpls.map((t: { id: string; code?: string; name: string; working_days_description?: string; alt_saturday_rule?: string; total_optional_holidays_allowed?: number; optional_selection_deadline_date?: string; is_default?: boolean }) => ({
        id: t.id,
        code: t.code || "",
        name: t.name,
        standard_working_days: t.working_days_description || "Monday to Friday",
        alt_saturday_rule: t.alt_saturday_rule || "none",
        optional_allowed: t.total_optional_holidays_allowed || 2,
        deadline_date: t.optional_selection_deadline_date || "",
        is_default: t.is_default || false,
      }))
    );
    setDefaultTemplateId(res.defaultTemplateId || "");
    setSelectedOptional(res.selectedOptional || []);
    setLoading(false);
  };

  useEffect(() => {
    loadCalendarData();
  }, []);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolName || !newHolDate) return;
    const res = await createHolidayAction(defaultTemplateId, newHolName, newHolDate, newHolIsOpt);
    if ("error" in res && res.error) {
      toast(res.error, "error");
    } else {
      const createdRecord = "record" in res ? (res.record as { id?: string } | undefined) : undefined;
      setHolidays([
        ...holidays,
        { id: createdRecord?.id || Date.now().toString(), name: newHolName, date: newHolDate, is_optional: newHolIsOpt },
      ]);
      setNewHolName("");
      setNewHolDate("");
      toast(`Holiday ${newHolName} added successfully.`);
    }
  };

  const handleToggleOptionalSelection = async (id: string) => {
    const isSelected = selectedOptional.includes(id);
    if (!isSelected && selectedOptional.length >= 2) {
      toast("Maximum Limit Reached: You can select a maximum of 2 optional holidays.", "error");
      return;
    }
    const next = isSelected ? selectedOptional.filter((hId) => hId !== id) : [...selectedOptional, id];
    setSelectedOptional(next);
    const res = await selectOptionalHolidayAction("", id, !isSelected);
    if ("error" in res && res.error) {
      toast(res.error, "error");
      setSelectedOptional(selectedOptional);
    }
  };

  return (
    <div className="space-y-6">
      {/* PageHeader (WS-B shared component) */}
      <PageHeader
        icon={<Calendar className="w-5 h-5 text-primary-600" aria-hidden="true" />}
        title="Work Calendar Templates & Holiday Selection"
        description="Manage multi-template work calendars, compulsory/optional holiday lists, and employee optional holiday selections."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBatchDrawer(true)}
              className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-xs"
            >
              <Upload className="w-4 h-4" /> Batch Assign Calendar (.xlsx / .csv)
            </button>
          </div>
        }
      />

      {loading ? (
        <PageLoading message="Loading calendar templates & holiday lists..." />
      ) : (
        <>
          {/* Calendar Templates Grid */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary-600" aria-hidden="true" /> Active Work Calendar Templates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.length === 0 ? (
                <EmptyState title="No calendar templates" description="No work calendar templates are configured." />
              ) : (
                templates.map((tpl) => (
                  <div key={tpl.id} className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-ink">{tpl.name}</span>
                      {tpl.is_default && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full">
                          DEFAULT TEMPLATE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-secondary">Standard Days: <span className="font-semibold text-ink">{tpl.standard_working_days}</span></p>
                    <p className="text-xs text-ink-secondary">Alt Saturday Rule: <span className="font-mono text-ink">{tpl.alt_saturday_rule}</span></p>
                    <p className="text-xs text-ink-secondary">Optional Holidays Allowed: <span className="font-semibold text-ink">{tpl.optional_allowed} days</span></p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Holiday Master List & Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Holiday Manager Table — shared DataTable */}
            <div className="lg:col-span-2 bg-surface rounded-xl border border-line shadow-card p-5 space-y-4">
              <h3 className="text-sm font-bold text-ink flex items-center justify-between border-b border-line pb-3">
                <span className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-primary-600" aria-hidden="true" /> Holiday Master List ({holidays.length})
                </span>
              </h3>

              <DataTable
                name="holidays"
                columns={[
                  { key: "name", header: "Holiday Name", sortable: true },
                  { key: "date", header: "Date" },
                  { key: "type", header: "Type" },
                  { key: "action", header: "Selection", headerClassName: "text-right" },
                ]}
                rows={holidays}
                getSortValue={(h: Holiday, key) => (key === "name" ? h.name : h.date)}
                empty={
                  <EmptyState
                    icon={<Gift className="w-8 h-8 text-ink-faint" />}
                    title="No holidays configured"
                    description="Add your first holiday entry using the form."
                  />
                }
                renderRow={(h: Holiday) => {
                  const isSelected = selectedOptional.includes(h.id);
                  return (
                    <tr key={h.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3 font-bold text-ink">{h.name}</td>
                      <td className="px-4 py-3 font-mono text-ink-secondary">{formatDateIndian(h.date)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={h.is_optional ? "draft" : "active"}
                          label={h.is_optional ? "Optional" : "Compulsory"}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {h.is_optional && (
                          <button
                            onClick={() => handleToggleOptionalSelection(h.id)}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                              isSelected
                                ? "bg-purple-600 text-white"
                                : "bg-surface-muted hover:bg-primary-50 text-ink-secondary"
                            }`}
                          >
                            {isSelected ? "Selected" : "+ Select"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }}
              />
            </div>

            {/* Add Holiday Form */}
            <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-4">
              <h3 className="text-sm font-bold text-ink border-b border-line pb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary-600" aria-hidden="true" /> Add New Holiday Entry
              </h3>

              <form onSubmit={handleAddHoliday} className="space-y-3 text-xs">
                <div>
                  <label htmlFor="holNameInput" className="block font-semibold text-ink-secondary mb-1">
                    Holiday Title *
                  </label>
                  <input
                    id="holNameInput"
                    type="text"
                    required
                    placeholder="e.g. Festival Day"
                    value={newHolName}
                    onChange={(e) => setNewHolName(e.target.value)}
                    className="w-full border border-line-strong rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label htmlFor="holDateInput" className="block font-semibold text-ink-secondary mb-1">
                    Date *
                  </label>
                  <input
                    id="holDateInput"
                    type="date"
                    required
                    value={newHolDate}
                    onChange={(e) => setNewHolDate(e.target.value)}
                    className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="isOptCheckbox"
                    type="checkbox"
                    checked={newHolIsOpt}
                    onChange={(e) => setNewHolIsOpt(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded border-line-strong"
                  />
                  <label htmlFor="isOptCheckbox" className="font-semibold text-ink-secondary cursor-pointer">
                    Optional Holiday (Float Leave)
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition shadow-xs"
                >
                  Add Holiday
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Shared Batch Upload Drawer */}
      <BatchUploadDrawer
        isOpen={showBatchDrawer}
        onClose={() => setShowBatchDrawer(false)}
        schema={CalendarAssignmentBatchSchema}
        onCommit={bulkAssignCalendarTemplate}
        onSuccess={async () => {
          await loadCalendarData();
          toast("Calendar template assignments updated successfully from batch upload.");
        }}
      />
    </div>
  );
}
