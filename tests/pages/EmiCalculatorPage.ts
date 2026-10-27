import { expect, type Locator, type Page } from '@playwright/test';
import { BarChart, PieChart } from './components/charts';
import { LoanForm, type LoanProduct } from './components/LoanForm';
import { MonthPicker } from './components/MonthPicker';
import { PaymentSummary } from './components/PaymentSummary';

export class EmiCalculatorPage {
  readonly form: LoanForm;
  readonly summary: PaymentSummary;
  readonly pieChart: PieChart;
  readonly barChart: BarChart;
  readonly scheduleStart: MonthPicker;

  constructor(private readonly page: Page) {
    this.form = new LoanForm(page);
    this.summary = new PaymentSummary(page);
    this.pieChart = new PieChart(page);
    this.barChart = new BarChart(page);
    this.scheduleStart = new MonthPicker(page);
  }

  /** `url` comes from config (EMI_CALCULATOR_URL). */
  async open(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(this.page.getByRole('heading', { level: 1, name: /EMI Calculator/ })).toBeVisible();
    // The charts are drawn by script after the HTML has loaded.
    await expect(this.pieChart.slices).toHaveCount(2);
  }

  productTab(product: LoanProduct): Locator {
    return this.page.getByRole('link', { name: product, exact: true });
  }

  /** Clicks a loan tab and waits until the form has switched to it. */
  async selectProduct(product: LoanProduct): Promise<void> {
    await this.productTab(product).click();
    await expect(this.form.amount(product)).toBeVisible();
  }
}
