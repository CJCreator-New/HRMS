import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class AttendancePage extends BasePage {
  readonly punchInButton: Locator;
  readonly punchOutButton: Locator;
  readonly requestCorrectionButtons: Locator;
  readonly correctionInInput: Locator;
  readonly correctionOutInput: Locator;
  readonly correctionReasonInput: Locator;
  readonly submitCorrectionButton: Locator;
  readonly approveCorrectionButtons: Locator;
  readonly rejectCorrectionButtons: Locator;

  constructor(page: Page, baseURL?: string) {
    super(page, baseURL);
    this.punchInButton = page.locator('[data-testid="punch-in-btn"]');
    this.punchOutButton = page.locator('[data-testid="punch-out-btn"]');
    this.requestCorrectionButtons = page.locator('button:has-text("Request Correction"), button:has-text("Correct")');
    this.correctionInInput = page.locator('[data-testid="correction-in-input"], input#reqInInput');
    this.correctionOutInput = page.locator('[data-testid="correction-out-input"], input#reqOutInput');
    this.correctionReasonInput = page.locator('[data-testid="correction-reason-input"], textarea#reasonInput');
    this.submitCorrectionButton = page.locator('[data-testid="submit-correction-btn"], button[type="submit"]:has-text("Submit")');
    this.approveCorrectionButtons = page.locator('[data-testid="approve-correction-btn"]');
    this.rejectCorrectionButtons = page.locator('[data-testid="reject-correction-btn"]');
  }

  async goto(): Promise<void> {
    await this.navigate("/attendance");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/attendance.*/);
    await expect(this.page.locator("body")).toContainText(/Attendance/i);
  }

  async punchIn(): Promise<void> {
    if (await this.punchInButton.isVisible()) {
      await this.punchInButton.click();
    }
  }

  async punchOut(): Promise<void> {
    if (await this.punchOutButton.isVisible()) {
      await this.punchOutButton.click();
    }
  }

  async openFirstCorrectionModal(): Promise<void> {
    const btn = this.requestCorrectionButtons.first();
    await expect(btn).toBeVisible();
    await btn.click();
  }

  async submitCorrection(checkIn: string = "09:00", checkOut: string = "18:00", reason: string = "Biometric reader sync issue"): Promise<void> {
    await this.openFirstCorrectionModal();
    await this.correctionInInput.fill(checkIn);
    await this.correctionOutInput.fill(checkOut);
    await this.correctionReasonInput.fill(reason);
    await this.submitCorrectionButton.click();
  }
}
