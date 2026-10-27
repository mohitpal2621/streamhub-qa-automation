import { expect, type Page } from '@playwright/test';
import type { SelfHealing } from '../self-healing/SelfHealing';
import type { BrittleLocator } from '../self-healing/types';
import { formatRupees, parseRupees } from '../support/money';

/**
 * Broken on purpose for the self-healing exercise. Leave them as they are:
 * `npm run test:healing:off` shows them failing and `npm run test:healing`
 * shows them being repaired at run time. docs/self-healing-locators.md has the
 * write-up; the working locators are in EmiCalculatorPage and its components.
 */
export const BRITTLE_LOCATORS = {
  personalLoanTab: {
    key: 'personalLoanTab',
    selector: 'xpath=/html/body/div[1]/div[3]/div/div[1]/div[1]/ul/li[2]/a',
    intent: 'the "Personal Loan" tab at the top of the loan calculator',
    expect: { role: 'link', name: /^Personal Loan$/ },
    why: 'An absolute XPath of the kind "Copy XPath" in DevTools produces. Every index depends on the layout above the calculator (ad slots, wrapper divs), so any change there breaks it. This one no longer matches anything.',
  },
  loanAmount: {
    key: 'loanAmount',
    selector: '#personal-loan-amount',
    intent: 'the "Personal Loan Amount" text box',
    expect: { role: 'textbox', name: /Loan Amount/, editable: true },
    why: 'A plausible id guessed from the label text, the kind an AI assistant writes without looking at the DOM. The real id is "loanamount".',
  },
  interestRate: {
    key: 'interestRate',
    selector: 'input[name="interest_rate"]',
    intent: 'the "Interest Rate" text box',
    expect: { role: 'textbox', name: /Interest Rate/, editable: true },
    why: 'A guessed snake_case name attribute. The page uses name="loaninterest".',
  },
  emiValue: {
    key: 'emiValue',
    selector: '#emipaymentsummary > div:nth-child(1) > p > span:nth-child(2)',
    intent: 'the monthly EMI amount under the "Loan EMI" heading',
    expect: { text: /^₹?\s?\d{1,3}(,\d{2,3})*$/ },
    why: 'Positional CSS that is off by one: the ₹ sign before the amount is a text node, not an element, so the amount is the first span in the paragraph, not the second.',
  },
  calculateButton: {
    key: 'calculateButton',
    selector: 'role=button[name="Calculate EMI"]',
    intent: 'a "Calculate EMI" button that recalculates the loan',
    expect: { role: 'button', name: /Calculate/ },
    why: 'There is no such button: the calculator recalculates when a field loses focus. Nothing on the page should be accepted in its place.',
  },
} satisfies Record<string, BrittleLocator>;

const ACTION_TIMEOUT = 5000;

export class BrittleEmiCalculatorPage {
  constructor(
    private readonly page: Page,
    private readonly healing: SelfHealing,
  ) {}

  async openPersonalLoanTab(): Promise<void> {
    const target = BRITTLE_LOCATORS.personalLoanTab;
    await (await this.healing.locate(target, 'open the Personal Loan tab')).click({ timeout: ACTION_TIMEOUT });
    await expect(this.page.getByLabel('Personal Loan Amount', { exact: true })).toBeVisible();
    this.healing.confirm(target);
  }

  async typeLoanAmount(amount: number): Promise<void> {
    const target = BRITTLE_LOCATORS.loanAmount;
    const input = await this.healing.locate(target, 'type the loan amount');
    await input.fill(String(amount), { timeout: ACTION_TIMEOUT });
    await input.press('Tab');
    await expect(input).toHaveValue(formatRupees(amount));
    this.healing.confirm(target);
  }

  async typeInterestRate(ratePercent: number): Promise<void> {
    const target = BRITTLE_LOCATORS.interestRate;
    const input = await this.healing.locate(target, 'type the interest rate');
    await input.fill(String(ratePercent), { timeout: ACTION_TIMEOUT });
    await input.press('Tab');
    await expect(input).toHaveValue(String(ratePercent));
    this.healing.confirm(target);
  }

  /** Waits until the EMI shown equals `expected` (to the rupee), then confirms the locator. */
  async expectEmi(expected: number): Promise<void> {
    const target = BRITTLE_LOCATORS.emiValue;
    const value = await this.healing.locate(target, 'read the monthly EMI');
    await expect.poll(async () => parseRupees(await value.innerText({ timeout: ACTION_TIMEOUT }))).toBe(expected);
    this.healing.confirm(target);
  }

  async clickCalculate(): Promise<void> {
    const target = BRITTLE_LOCATORS.calculateButton;
    await (await this.healing.locate(target, 'click Calculate EMI')).click({ timeout: ACTION_TIMEOUT });
  }
}
