export interface StatutoryCalcInput {
  basicMonthly: number;
  grossMonthly: number;
  ptState: string;
  taxRegime: "new_regime" | "old_regime";
  pfApplicable: boolean;
  esiApplicable: boolean;
  /** Optional: employee's 80C deductions for Old Regime */
  section80c?: number;
  /** Optional: employee's 80D deductions for Old Regime */
  section80d?: number;
  /** Optional: YTD PT already deducted in the financial year (H-08) */
  ytdPtDeducted?: number;
}

export interface StatutoryCalcResult {
  pfEmployeeAmount: number;
  pfEmployerAmount: number;
  esiEmployeeAmount: number;
  esiEmployerAmount: number;
  ptAmount: number;
  lwfAmount: number;
  monthlyTds: number;
  totalDeduction: number;
}

/** Professional Tax slabs by state (monthly gross thresholds) */
const PT_SLABS: Record<string, Array<{ min: number; max: number; tax: number }>> = {
  Karnataka: [
    { min: 0, max: 24999, tax: 0 },
    { min: 25000, max: Infinity, tax: 200 },
  ],
  Maharashtra: [
    { min: 0, max: 9999, tax: 0 },
    { min: 10000, max: Infinity, tax: 200 },
  ],
  "Tamil Nadu": [
    { min: 0, max: 14999, tax: 0 },
    { min: 15000, max: Infinity, tax: 200 },
  ],
  Telangana: [
    { min: 0, max: 14999, tax: 0 },
    { min: 15000, max: Infinity, tax: 200 },
  ],
  "Andhra Pradesh": [
    { min: 0, max: 14999, tax: 0 },
    { min: 15000, max: Infinity, tax: 200 },
  ],
  Gujarat: [
    { min: 0, max: 12499, tax: 0 },
    { min: 12500, max: Infinity, tax: 200 },
  ],
  "West Bengal": [
    { min: 0, max: 9999, tax: 0 },
    { min: 10000, max: 14999, tax: 130 },
    { min: 15000, max: Infinity, tax: 200 },
  ],
  Kerala: [
    { min: 0, max: 11999, tax: 0 },
    { min: 12000, max: Infinity, tax: 200 },
  ],
};

/** Labour Welfare Fund amounts by state (monthly) */
const LWF_AMOUNTS: Record<string, number> = {
  Maharashtra: 12,
  Karnataka: 20,
  "Tamil Nadu": 20,
  "Andhra Pradesh": 20,
  Gujarat: 12,
  "West Bengal": 15,
  Kerala: 20,
};

/**
 * Computes all Indian statutory deductions for a payroll period.
 *
 * Returns both employee and employer contribution amounts, plus PT, LWF, and TDS.
 */
export function computeIndiaStatutoryDeductions(
  input: StatutoryCalcInput
): StatutoryCalcResult {
  // 1. Provident Fund (PF): 12% employee + 12% employer, capped at ₹15,000 basic wage
  let pfEmployeeAmount = 0;
  let pfEmployerAmount = 0;
  if (input.pfApplicable) {
    const pfWage = Math.min(input.basicMonthly, 15000);
    pfEmployeeAmount = Math.round(pfWage * 0.12);
    pfEmployerAmount = Math.round(pfWage * 0.12);
  }

  // 2. Employees' State Insurance (ESI): 0.75% employee + 3.25% employer if gross <= ₹21,000
  let esiEmployeeAmount = 0;
  let esiEmployerAmount = 0;
  if (input.esiApplicable && input.grossMonthly <= 21000) {
    esiEmployeeAmount = Math.ceil(input.grossMonthly * 0.0075);
    esiEmployerAmount = Math.ceil(input.grossMonthly * 0.0325);
  }

  // 3. Professional Tax (PT): State-specific slabs with annual ₹2,500 cap (H-08)
  let ptAmount = 0;
  const slabs = PT_SLABS[input.ptState];
  if (slabs) {
    for (const slab of slabs) {
      if (input.grossMonthly >= slab.min && input.grossMonthly <= slab.max) {
        ptAmount = slab.tax;
        break;
      }
    }
  }

  if (input.ytdPtDeducted != null) {
    ptAmount = Math.min(ptAmount, Math.max(0, 2500 - input.ytdPtDeducted));
  }

  // 4. Labour Welfare Fund (LWF): State-specific monthly deduction
  const lwfAmount = LWF_AMOUNTS[input.ptState] || 0;

  // 5. Income Tax TDS (FY 2025-26)
  const annualGross = input.grossMonthly * 12;
  let annualTds = 0;

  if (input.taxRegime === "new_regime") {
    // New Tax Regime (FY 2025-26): Standard deduction ₹75,000
    // Slabs: 0-4L Nil, 4-8L 5%, 8-12L 10%, 12-16L 15%, 16-20L 20%, 20-24L 25%, >24L 30%
    const taxableIncome = Math.max(0, annualGross - 75000);
    if (taxableIncome <= 1200000) {
      annualTds = 0; // Full Rebate u/s 87A up to ₹12,00,000
    } else {
      // Base tax at ₹12,00,000 is ₹60,000 (20k + 40k)
      let baseTax = 60000;
      if (taxableIncome <= 1600000) {
        baseTax += (taxableIncome - 1200000) * 0.15;
      } else if (taxableIncome <= 2000000) {
        baseTax += 60000 + (taxableIncome - 1600000) * 0.20;
      } else if (taxableIncome <= 2400000) {
        baseTax += 60000 + 80000 + (taxableIncome - 2000000) * 0.25;
      } else {
        baseTax += 60000 + 80000 + 100000 + (taxableIncome - 2400000) * 0.30;
      }
      // Section 87A Marginal Relief: Tax payable cannot exceed excess income over ₹12,00,000
      const excessIncome = taxableIncome - 1200000;
      let computedTax = Math.min(baseTax, excessIncome);

      // Surcharge for High Earners (H-09)
      let surcharge = 0;
      if (taxableIncome > 20000000) {
        surcharge = computedTax * 0.25; // 25% for >2Cr
      } else if (taxableIncome > 10000000) {
        surcharge = computedTax * 0.15; // 15% for >1Cr
      } else if (taxableIncome > 5000000) {
        surcharge = computedTax * 0.10; // 10% for >50L
      }

      // Mandatory 4% Health & Education Cess (C-06)
      annualTds = Math.round((computedTax + surcharge) * 1.04);
    }
  } else {
    // Old Tax Regime (FY 2025-26): Standard deduction ₹50,000
    const section80c = Math.min(input.section80c || 0, 150000); // Max 80C = 1.5L
    const section80d = input.section80d || 0;
    const taxableIncome = Math.max(0, annualGross - 50000 - section80c - section80d);

    let baseTax = 0;
    if (taxableIncome <= 250000) {
      baseTax = 0;
    } else if (taxableIncome <= 500000) {
      baseTax = Math.round((taxableIncome - 250000) * 0.05);
    } else if (taxableIncome <= 1000000) {
      baseTax = Math.round(12500 + (taxableIncome - 500000) * 0.20);
    } else {
      baseTax = Math.round(112500 + (taxableIncome - 1000000) * 0.30);
    }

    // Health & Education Cess: 4% on total tax
    annualTds = Math.round(baseTax * 1.04);
  }

  const monthlyTds = Math.round(annualTds / 12);

  const totalDeduction =
    pfEmployeeAmount + esiEmployeeAmount + ptAmount + lwfAmount + monthlyTds;

  return {
    pfEmployeeAmount,
    pfEmployerAmount,
    esiEmployeeAmount,
    esiEmployerAmount,
    ptAmount,
    lwfAmount,
    monthlyTds,
    totalDeduction,
  };
}
