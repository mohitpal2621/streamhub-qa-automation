import { After, Before, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { BrittleEmiCalculatorPage } from '../pages/BrittleEmiCalculatorPage';
import { claudeHealer } from '../self-healing/claude-healer';
import { heuristicHealer } from '../self-healing/heuristic-healer';
import { addRecords, writeHealReport } from '../self-healing/report';
import { SelfHealing } from '../self-healing/SelfHealing';
import { loanTotals } from '../support/emi';
import type { TestWorld } from '../support/world';

// Defined after the @ui hooks in tests/support, so the page already exists.
Before({ tags: '@self-healing' }, function (this: TestWorld) {
  this.healing = new SelfHealing(this.page, {
    enabled: this.parameters.healing ?? false,
    healer: this.parameters.healer === 'claude' ? claudeHealer : heuristicHealer,
    scenario: this.scenarioName,
    probeTimeout: 2000,
  });
  this.brittlePage = new BrittleEmiCalculatorPage(this.page, this.healing);
  this.brittleLoan = {};
});

After({ tags: '@self-healing' }, function (this: TestWorld) {
  addRecords(this.healing.records);
  if (this.parameters.healing) writeHealReport(this.parameters.reportDir);
});

When('I open the Personal Loan tab through its brittle locator', async function (this: TestWorld) {
  await this.brittlePage.openPersonalLoanTab();
});

When('I type {amount} into the loan amount box through its brittle locator', async function (this: TestWorld, amount: number) {
  await this.brittlePage.typeLoanAmount(amount);
  this.brittleLoan.amount = amount;
});

When(
  'I type {float}% into the interest rate box through its brittle locator',
  async function (this: TestWorld, ratePercent: number) {
    await this.brittlePage.typeInterestRate(ratePercent);
    this.brittleLoan.ratePercent = ratePercent;
  },
);

When('I set the tenure to {int} years', async function (this: TestWorld, years: number) {
  const { tenure } = this.emiCalculator.form;
  await tenure.fill(String(years));
  await tenure.press('Tab');
  this.brittleLoan.tenureYears = years;
});

Then('the EMI read through its brittle locator matches my own calculation', async function (this: TestWorld) {
  const { amount, ratePercent, tenureYears } = this.brittleLoan;
  const { emi } = loanTotals({ principal: amount!, annualRatePercent: ratePercent!, tenureMonths: tenureYears! * 12 });
  await this.brittlePage.expectEmi(Math.round(emi));
  await this.screenshot('emi read through healed locators', this.page.locator('#loanformcontainer'));
});

Then('clicking the "Calculate EMI" button through its brittle locator fails', async function (this: TestWorld) {
  await expect(this.brittlePage.clickCalculate()).rejects.toThrow();
});

Then('no replacement was accepted for the {string} locator', function (this: TestWorld, key: string) {
  const healed = this.healing.records.filter((record) => record.key === key && record.outcome === 'healed');
  expect(healed).toEqual([]);
});
