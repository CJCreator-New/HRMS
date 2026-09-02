"use client";

import { useState, useEffect } from "react";

/**
 * Standard enterprise feature flag definitions (P3-2).
 */
export const FEATURE_FLAGS = {
  AI_PAYROLL_INSIGHTS: "AI_PAYROLL_INSIGHTS",
  BIO_ATTENDANCE_V2: "BIO_ATTENDANCE_V2",
  BULK_EMPLOYEE_IMPORT: "BULK_EMPLOYEE_IMPORT",
  ADVANCED_EXPENSE_POLICIES: "ADVANCED_EXPENSE_POLICIES",
  REDIS_DISTRIBUTED_CACHE: "REDIS_DISTRIBUTED_CACHE",
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export interface FlagEvaluationContext {
  employeeId?: string;
  userRole?: string;
  email?: string;
}

const DEFAULT_FLAGS: Record<FeatureFlagKey, boolean> = {
  AI_PAYROLL_INSIGHTS: false,
  BIO_ATTENDANCE_V2: true,
  BULK_EMPLOYEE_IMPORT: true,
  ADVANCED_EXPENSE_POLICIES: true,
  REDIS_DISTRIBUTED_CACHE: true,
};

/**
 * Evaluates whether a feature flag is active.
 * Checks environment variable NEXT_PUBLIC_FF_<KEY> / FF_<KEY> with fallback to DEFAULT_FLAGS.
 */
export function isFeatureEnabled(
  flag: FeatureFlagKey,
  context?: FlagEvaluationContext
): boolean {
  // Check browser/server env overrides
  const envKey = `NEXT_PUBLIC_FF_${flag}`;
  const serverEnvKey = `FF_${flag}`;

  const envVal =
    typeof process !== "undefined"
      ? process.env[envKey] ?? process.env[serverEnvKey]
      : undefined;

  if (envVal !== undefined) {
    return envVal === "true" || envVal === "1";
  }

  // Canary check: allow specific roles or admin bypass if specified
  if (context?.userRole === "system_admin" || context?.userRole === "hr_admin") {
    return true;
  }

  return DEFAULT_FLAGS[flag] ?? false;
}

/**
 * React hook for consuming feature flags in client components.
 */
export function useFeatureFlag(
  flag: FeatureFlagKey,
  context?: FlagEvaluationContext
): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => isFeatureEnabled(flag, context));

  useEffect(() => {
    setEnabled(isFeatureEnabled(flag, context));
  }, [flag, context?.employeeId, context?.userRole]);

  return enabled;
}
