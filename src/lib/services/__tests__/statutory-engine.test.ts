import { describe, it, expect } from "vitest";
import { computeIndiaStatutoryDeductions } from "../statutory-engine";

describe("Statutory Engine Unit Tests (Indian Statutory Compliance)", () => {
  it("caps Provident Fund (PF) basic wage at ₹15,000", () => {
    const highSalary = computeIndiaStatutoryDeductions({
      basicMonthly: 40000,
      grossMonthly: 80000,
      ptState: "Karnataka",
      taxRegime: "new_regime",
      pfApplicable: true,
      esiApplicable: false,
    });
    // 12% of capped ₹15,000 = ₹1,800
    expect(highSalary.pfEmployeeAmount).toBe(1800);
  });

  it("calculates ESI only when gross is <= ₹21,000", () => {
    const eligibleEsi = computeIndiaStatutoryDeductions({
      basicMonthly: 10000,
      grossMonthly: 20000,
      ptState: "Karnataka",
      taxRegime: "new_regime",
      pfApplicable: true,
      esiApplicable: true,
    });
    // 0.75% of 20,000 = ₹150
    expect(eligibleEsi.esiEmployeeAmount).toBe(150);

    const ineligibleEsi = computeIndiaStatutoryDeductions({
      basicMonthly: 15000,
      grossMonthly: 30000,
      ptState: "Karnataka",
      taxRegime: "new_regime",
      pfApplicable: true,
      esiApplicable: true,
    });
    expect(ineligibleEsi.esiEmployeeAmount).toBe(0);
  });

  it("applies state-specific Professional Tax (PT) slabs correctly", () => {
    const karnatakaPt = computeIndiaStatutoryDeductions({
      basicMonthly: 20000,
      grossMonthly: 40000,
      ptState: "Karnataka",
      taxRegime: "new_regime",
      pfApplicable: true,
      esiApplicable: false,
    });
    expect(karnatakaPt.ptAmount).toBe(200);

    const maharashtraLow = computeIndiaStatutoryDeductions({
      basicMonthly: 4000,
      grossMonthly: 8000,
      ptState: "Maharashtra",
      taxRegime: "new_regime",
      pfApplicable: false,
      esiApplicable: false,
    });
    expect(maharashtraLow.ptAmount).toBe(0);
  });

  it("applies Section 87A full rebate up to ₹12,00,000 in New Tax Regime", () => {
    // Gross monthly = 1,00,000 -> Annual = 12,00,000. Less 75k standard deduction = 11,25,000 (<= 12L) -> TDS = 0
    const rebateSalary = computeIndiaStatutoryDeductions({
      basicMonthly: 50000,
      grossMonthly: 100000,
      ptState: "Karnataka",
      taxRegime: "new_regime",
      pfApplicable: true,
      esiApplicable: false,
    });
    expect(rebateSalary.monthlyTds).toBe(0);
  });

  it("applies Section 87A marginal relief when income marginally exceeds ₹12,00,000", () => {
    // Gross monthly = 1,07,000 -> Annual = 12,84,000. Less 75k = 12,09,000. Excess = ₹9,000.
    // Marginal relief caps tax to ₹9,000 + 4% cess = ₹9,360 -> Monthly TDS = 780
    const marginalSalary = computeIndiaStatutoryDeductions({
      basicMonthly: 50000,
      grossMonthly: 107000,
      ptState: "Karnataka",
      taxRegime: "new_regime",
      pfApplicable: true,
      esiApplicable: false,
    });
    expect(marginalSalary.monthlyTds).toBe(780);
  });

  it("covers the 16L-20L new-regime slab", () => {
    // taxable = 147917*12 - 75000 = 1,700,004 → base 140,001 + 4% cess = 145,601 → monthly 12,133
    const result = computeIndiaStatutoryDeductions({
      basicMonthly: 70000,
      grossMonthly: 147917,
      ptState: "Karnataka",
      taxRegime: "new_regime",
      pfApplicable: true,
      esiApplicable: false,
    });
    expect(result.monthlyTds).toBe(12133);
  });

  it("covers the 20L-24L new-regime slab", () => {
    // taxable = 181250*12 - 75000 = 2,100,000 → base 225,000 + 4% cess = 234,000 → monthly 19,500
    const result = computeIndiaStatutoryDeductions({
      basicMonthly: 90000,
      grossMonthly: 181250,
      ptState: "Karnataka",
      taxRegime: "new_regime",
      pfApplicable: true,
      esiApplicable: false,
    });
    expect(result.monthlyTds).toBe(19500);
  });

  it("covers the above-24L new-regime slab", () => {
    // taxable = 256250*12 - 75000 = 3,000,000 → base 480,000 + 4% cess = 499,200 → monthly 41,600
    const result = computeIndiaStatutoryDeductions({
      basicMonthly: 120000,
      grossMonthly: 256250,
      ptState: "Karnataka",
      taxRegime: "new_regime",
      pfApplicable: true,
      esiApplicable: false,
    });
    expect(result.monthlyTds).toBe(41600);
  });

  it("applies old-regime TDS above the ₹5L exemption with 4% cess", () => {
    // taxable = 70000*12 - 50000 = 790,000
    // Tax: 12,500 + (790k-500k)*0.20 = 70,500
    // Cess: 70,500 * 1.04 = 73,320 → monthly 6,110
    const result = computeIndiaStatutoryDeductions({
      basicMonthly: 35000,
      grossMonthly: 70000,
      ptState: "Karnataka",
      taxRegime: "old_regime",
      pfApplicable: true,
      esiApplicable: false,
    });
    expect(result.monthlyTds).toBe(6110);
  });

  it("applies correct old-regime TDS for income in 2.5L-5L slab", () => {
    // taxable = 40000*12 - 50000 = 430,000
    // Tax: (430k - 250k) * 0.05 = 9,000
    // Cess: 9,000 * 1.04 = 9,360 → monthly 780
    const result = computeIndiaStatutoryDeductions({
      basicMonthly: 20000,
      grossMonthly: 40000,
      ptState: "Karnataka",
      taxRegime: "old_regime",
      pfApplicable: true,
      esiApplicable: false,
    });
    expect(result.monthlyTds).toBe(780);
  });

  it("levies no old-regime TDS at or below ₹2.5L taxable income", () => {
    // taxable = 20000*12 - 50000 = 190,000 → below 2.5L → tax 0
    const result = computeIndiaStatutoryDeductions({
      basicMonthly: 10000,
      grossMonthly: 20000,
      ptState: "Karnataka",
      taxRegime: "old_regime",
      pfApplicable: true,
      esiApplicable: false,
    });
    expect(result.monthlyTds).toBe(0);
  });

  it("covers the remaining state PT slab branches", () => {
    const maharashtraHigh = computeIndiaStatutoryDeductions({
      basicMonthly: 10000, grossMonthly: 20000, ptState: "Maharashtra",
      taxRegime: "new_regime", pfApplicable: false, esiApplicable: false,
    });
    expect(maharashtraHigh.ptAmount).toBe(200);

    const tamilNaduHigh = computeIndiaStatutoryDeductions({
      basicMonthly: 10000, grossMonthly: 20000, ptState: "Tamil Nadu",
      taxRegime: "new_regime", pfApplicable: false, esiApplicable: false,
    });
    expect(tamilNaduHigh.ptAmount).toBe(200);

    const tamilNaduLow = computeIndiaStatutoryDeductions({
      basicMonthly: 6000, grossMonthly: 12000, ptState: "Tamil Nadu",
      taxRegime: "new_regime", pfApplicable: false, esiApplicable: false,
    });
    expect(tamilNaduLow.ptAmount).toBe(0);

    const telangana = computeIndiaStatutoryDeductions({
      basicMonthly: 10000, grossMonthly: 20000, ptState: "Telangana",
      taxRegime: "new_regime", pfApplicable: false, esiApplicable: false,
    });
    expect(telangana.ptAmount).toBe(200);

    const karnatakaLow = computeIndiaStatutoryDeductions({
      basicMonthly: 10000, grossMonthly: 20000, ptState: "Karnataka",
      taxRegime: "new_regime", pfApplicable: false, esiApplicable: false,
    });
    expect(karnatakaLow.ptAmount).toBe(0);
  });
});

