"use client";

import React from "react";
import { Check } from "lucide-react";

/**
 * Guided workflow stepper (WS-B pattern library, consumed by Phase 2 flows).
 *
 * Renders a horizontal step trail with numbered circles. The active step is
 * announced via `aria-current="step"`; completed steps render a check icon.
 * Steps expose `data-testid="{testId}-step-{index+1}"` so the FLW E2E specs
 * can assert progression.
 */

interface StepperProps {
  steps: string[];
  /** 0-based index of the active step. */
  current: number;
  /** Base testid — defaults to "stepper". */
  testId?: string;
  className?: string;
}

export function Stepper({ steps, current, testId = "stepper", className = "" }: StepperProps) {
  return (
    <nav aria-label="Progress" data-testid={testId} className={`w-full overflow-x-auto ${className}`}>
      <ol className="flex items-center w-full min-w-max">
        {steps.map((step, index) => {
          const isCompleted = index < current;
          const isActive = index === current;
          return (
            <li
              key={step}
              className={`flex items-center ${index < steps.length - 1 ? "flex-1" : ""}`}
            >
              <div className="flex flex-col items-center">
                <span
                  data-testid={`${testId}-step-${index + 1}`}
                  aria-current={isActive ? "step" : undefined}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition ${
                    isCompleted
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : isActive
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : "bg-white border-gray-300 text-gray-500"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={`mt-1.5 text-[10px] font-semibold uppercase tracking-wide hidden sm:block ${
                    isActive ? "text-blue-700" : isCompleted ? "text-emerald-700" : "text-gray-500"
                  }`}
                >
                  {step}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`flex-1 h-0.5 mx-2 rounded ${index < current ? "bg-emerald-600" : "bg-gray-200"}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Stepper;
