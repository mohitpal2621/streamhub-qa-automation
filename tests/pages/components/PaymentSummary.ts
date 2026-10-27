import type { Locator, Page } from '@playwright/test';
import { parseRupees } from '../../support/money';

export interface DisplayedTotals {
  emi: number;
  totalInterest: number;
  totalPayment: number;
}

/** The "Loan EMI / Total Interest Payable / Total Payment" panel, read by its headings. */
export class PaymentSummary {
  constructor(private readonly page: Page) {}

  private valueUnder(heading: string | RegExp): Locator {
    return this.page
      .locator('#emipaymentsummary div')
      .filter({ has: this.page.getByRole('heading', { name: heading }) })
      .locator('p');
  }

  get emi(): Locator {
    return this.valueUnder('Loan EMI');
  }

  get totalInterest(): Locator {
    return this.valueUnder('Total Interest Payable');
  }

  get totalPayment(): Locator {
    return this.valueUnder(/^Total Payment/);
  }

  async values(): Promise<DisplayedTotals> {
    return {
      emi: parseRupees(await this.emi.innerText()),
      totalInterest: parseRupees(await this.totalInterest.innerText()),
      totalPayment: parseRupees(await this.totalPayment.innerText()),
    };
  }
}
