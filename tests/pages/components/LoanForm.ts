import type { Locator, Page } from '@playwright/test';
import { Slider } from './Slider';

export type LoanProduct = 'Home Loan' | 'Personal Loan' | 'Car Loan';

export interface LoanInput {
  amount: number;
  ratePercent: number;
  tenureYears: number;
}

/** The three loan fields. The amount label changes with the tab ("Home Loan Amount", "Personal Loan Amount"). */
export class LoanForm {
  constructor(private readonly page: Page) {}

  amount(product: LoanProduct): Locator {
    return this.page.getByLabel(`${product} Amount`, { exact: true });
  }

  get interestRate(): Locator {
    return this.page.getByLabel('Interest Rate', { exact: true });
  }

  get tenure(): Locator {
    return this.page.getByLabel('Loan Tenure', { exact: true });
  }

  /** Types the values into the text boxes. The calculator recalculates when a box loses focus. */
  async type(product: LoanProduct, loan: LoanInput): Promise<void> {
    await this.useYears();
    for (const [field, value] of [
      [this.amount(product), loan.amount],
      [this.interestRate, loan.ratePercent],
      [this.tenure, loan.tenureYears],
    ] as const) {
      await field.fill(String(value));
      await field.press('Tab');
    }
  }

  /** Sets the values by dragging the sliders instead of typing. */
  async slide(product: LoanProduct, loan: LoanInput): Promise<void> {
    await this.useYears();
    await new Slider(this.page, this.amount(product)).dragTo(loan.amount);
    await new Slider(this.page, this.interestRate).dragTo(loan.ratePercent);
    await new Slider(this.page, this.tenure).dragTo(loan.tenureYears);
  }

  /** The tenure box can hold years or months; the steps in this suite give years. */
  private async useYears(): Promise<void> {
    const years = this.page.getByRole('radio', { name: 'Yr' });
    if (!(await years.isChecked())) await this.page.getByText('Yr', { exact: true }).click();
  }
}
