"use client";

import React, { useState, useEffect } from "react";
import { Building2, Plus, Edit2, Search, Upload } from "lucide-react";
import {
  getDepartmentsAction,
  createDepartmentAction,
  toggleDepartmentActiveAction,
  updateDepartmentAction,
  bulkAssignDepartments,
} from "@/lib/actions/departments";
import { PageHeader } from "@/components/shared/PageHeader";
import { Modal } from "@/components/shared/Modal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/components/shared/Toast";
import { BatchUploadDrawer } from "@/components/shared/batch-import/BatchUploadDrawer";
import { DepartmentAssignmentBatchSchema } from "@/lib/batch-import/schemas";

interface Department {
  id: string;
  name: string;
  active: boolean;
  employee_count: number;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);
  const [showBatchDrawer, setShowBatchDrawer] = useState(false);
  const { toast } = useToast();

  const loadDepts = async () => {
    setLoading(true);
    const res = await getDepartmentsAction();
    const mapped: Department[] = (res.departments || []).map((d: { id: string; name: string; active?: boolean; employee_count?: number }) => ({
      id: d.id,
      name: d.name,
      active: d.active ?? true,
      employee_count: d.employee_count || 0,
    }));
    setDepartments(mapped);
    setLoading(false);
  };

  useEffect(() => { loadDepts(); }, []);

  const filteredDepts = departments.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("name", newDeptName.trim());
    const res = await createDepartmentAction(fd);
    if (res.error) { toast(res.error, "error"); } else {
      await loadDepts();
      setNewDeptName("");
      setShowAddModal(false);
      toast("Department created successfully.");
    }
    setSaving(false);
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const res = await toggleDepartmentActiveAction(id, !currentActive);
    if (!res.error) {
      setDepartments(
        departments.map((d) => (d.id === id ? { ...d, active: !currentActive } : d))
      );
      toast(`Department ${currentActive ? "deactivated" : "activated"}.`);
    }
  };

  const handleEditDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept || !editingDept.name.trim()) return;
    const res = await updateDepartmentAction(editingDept.id, editingDept.name.trim());
    if (!res.error) {
      setDepartments(
        departments.map((d) => (d.id === editingDept.id ? editingDept : d))
      );
      setEditingDept(null);
      toast("Department updated.");
    }
  };

  return (
    <div className="space-y-6">
      {/* PageHeader (WS-B shared component) */}
      <PageHeader
        icon={<Building2 className="w-5 h-5 text-primary-600" aria-hidden="true" />}
        title="Department Master Management"
        description="Create, edit, and manage organizational departments and their active status."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBatchDrawer(true)}
              className="px-3.5 py-2 bg-surface hover:bg-surface-muted border border-line text-ink text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-xs"
            >
              <Upload className="w-4 h-4 text-primary-600" /> Batch Assign (.xlsx / .csv)
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4" /> Add New Department
            </button>
          </div>
        }
      />

      {/* Search & Stats */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs border border-line-strong rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-primary-300 focus:outline-none bg-surface"
          />
          <Search className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" />
        </div>
        <p className="text-xs text-ink-muted font-medium">
          Total Departments: <span className="font-bold text-ink">{departments.length}</span>
        </p>
      </div>

      {/* Department Table — shared DataTable */}
      <div className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-muted text-xs">Loading departments...</div>
        ) : filteredDepts.length === 0 ? (
          <EmptyState
            title="No departments found"
            description={searchTerm ? "Try a different search term." : "Create your first department to get started."}
          />
        ) : (
          <DataTable
            name="departments"
            columns={[
              { key: "name", header: "Department Name", sortable: true },
              { key: "employee_count", header: "Headcount" },
              { key: "active", header: "Status" },
              { key: "actions", header: "Actions", headerClassName: "text-right" },
            ]}
            rows={filteredDepts}
            getSortValue={(d: Department, key) => (key === "name" ? d.name : "")}
            renderRow={(dept: Department) => (
              <tr key={dept.id} className="hover:bg-surface-muted/50 transition">
                <td className="px-6 py-4 font-semibold text-ink">{dept.name}</td>
                <td className="px-6 py-4 text-ink-secondary">{dept.employee_count} employees</td>
                <td className="px-6 py-4">
                  <StatusBadge
                    status={dept.active ? "active" : "deactivated"}
                    label={dept.active ? "Active" : "Deactivated"}
                  />
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => setEditingDept(dept)}
                    className="p-1.5 text-ink-faint hover:text-primary-600 hover:bg-primary-50 rounded transition"
                    title="Edit Department"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(dept.id, dept.active)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                      dept.active
                        ? "bg-red-50 text-red-600 hover:bg-red-100"
                        : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    }`}
                  >
                    {dept.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            )}
          />
        )}
      </div>

      {/* Add Modal (shared Modal — focus trap, Escape, scroll lock) */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Department"
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleAddDept} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Department Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Quality Assurance"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              className="w-full text-xs border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-300 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-muted rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Department"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal (shared Modal) */}
      <Modal
        isOpen={!!editingDept}
        onClose={() => setEditingDept(null)}
        title="Edit Department"
        maxWidth="max-w-sm"
      >
        {editingDept && (
          <form onSubmit={handleEditDept} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Department Name</label>
              <input
                type="text"
                required
                value={editingDept.name}
                onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                className="w-full text-xs border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-300 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingDept(null)}
                className="px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-muted rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
              >
                Update Department
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Shared Batch Upload Drawer */}
      <BatchUploadDrawer
        isOpen={showBatchDrawer}
        onClose={() => setShowBatchDrawer(false)}
        schema={DepartmentAssignmentBatchSchema}
        onCommit={bulkAssignDepartments}
        onSuccess={async () => {
          await loadDepts();
          toast("Department & hierarchy assignments updated successfully from batch upload.");
        }}
      />
    </div>
  );
}
