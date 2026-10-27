import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { LoanProduct } from '../pages/components/LoanForm';
import type { DisplayedTotals } from '../pages/components/PaymentSummary';
import { config } from '../support/config';
import { loanTotals, yearlySchedule, type LoanTerms } from '../support/emi';
import { formatRupees, parseRupees } from '../support/money';
import type { TestWorld } from '../support/world';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function termsOf(world: TestWorld): LoanTerms {
  if (!world.loan) throw new Error('No loan has been entered in this scenario');
  return { principal: world.loan.amount, annualRatePercent: world.loan.ratePercent, tenureMonths: world.loan.tenureYears * 12 };
}

function productOf(world: TestWorld): LoanProduct {
  if (!world.product) throw new Error('No loan tab has been opened in this scenario');
  return world.product;
}

/** The page rounds to whole rupees; one rupee of slack covers a .5 rounded the other way. */
function mismatches(shown: DisplayedTotals, expected: DisplayedTotals): string[] {
  return (Object.keys(expected) as (keyof DisplayedTotals)[])
    .filter((key) => Math.abs(shown[key] - expected[key]) > 1)
    .map((key) => `${key}: page shows ₹${formatRupees(shown[key])}, expected ₹${formatRupees(expected[key])}`);
}

Given('I open the EMI calculator', async function (this: TestWorld) {
  await this.emiCalculator.open(config.emiCalculatorUrl);
});

Given('I open the {string} tab', async function (this: TestWorld, product: LoanProduct) {
  await this.emiCalculator.selectProduct(product);
  this.product = product;
});

When(
  'I enter a loan amount of {amount}, an interest rate of {float}% and a tenure of {int} years',
  async function (this: TestWorld, amount: number, ratePercent: number, tenureYears: number) {
    this.loan = { amount, ratePercent, tenureYears };
    await this.emiCalculator.form.type(productOf(this), this.loan);
  },
);

When(
  'I drag the sliders to a loan amount of {amount}, an interest rate of {float}% and a tenure of {int} years',
  async function (this: TestWorld, amount: number, ratePercent: number, tenureYears: number) {
    this.loan = { amount, ratePercent, tenureYears };
    await this.emiCalculator.form.slide(productOf(this), this.loan);
  },
);

When('I change the schedule start month to {string}', async function (this: TestWorld, monthAndYear: string) {
  const [month, year] = monthAndYear.split(' ');
  await this.emiCalculator.scheduleStart.choose(month, Number(year));
  this.scheduleStart = { year: Number(year), month: MONTHS.indexOf(month) + 1 };
});

Then('the EMI, total interest and total payment match my own calculation', async function (this: TestWorld) {
  const exact = loanTotals(termsOf(this));
  const expected = {
    emi: Math.round(exact.emi),
    totalInterest: Math.round(exact.totalInterest),
    totalPayment: Math.round(exact.totalPayment),
  };
  const { summary } = this.emiCalculator;
  // The page recalculates when the last field loses focus, so poll until it settles.
  await expect.poll(async () => mismatches(await summary.values(), expected), { timeout: config.timeouts.action }).toEqual([]);

  const shown = await summary.values();
  this.attach(
    [
      `Loan: ₹${formatRupees(this.loan!.amount)} at ${this.loan!.ratePercent}% for ${this.loan!.tenureYears} years`,
      `EMI            expected ₹${formatRupees(expected.emi)}  shown ₹${formatRupees(shown.emi)}`,
      `Total interest expected ₹${formatRupees(expected.totalInterest)}  shown ₹${formatRupees(shown.totalInterest)}`,
      `Total payment  expected ₹${formatRupees(expected.totalPayment)}  shown ₹${formatRupees(shown.totalPayment)}`,
    ].join('\n'),
  );
  await this.emiCalculator.pieChart.settled();
  await this.screenshot('calculated EMI', this.page.locator('#loanformcontainer'));
});

Then('the payment break-up pie chart is visible', async function (this: TestWorld) {
  const { pieChart } = this.emiCalculator;
  await pieChart.container.scrollIntoViewIfNeeded();
  await expect(pieChart.container).toBeVisible();
  await expect(pieChart.title).toHaveText('Break-up of Total Payment');
  await expect(pieChart.slices).toHaveCount(2);
  for (const slice of await pieChart.slices.all()) await expect(slice).toBeVisible();
  await pieChart.settled();
  await this.screenshot('pie chart', pieChart.container);
});

Then('both sections of the pie chart show values greater than zero', async function (this: TestWorld) {
  const sections = await this.emiCalculator.pieChart.sections();
  this.attach(sections.map((s) => `${s.name}: label "${s.label}", value ₹${formatRupees(s.value)}`).join('\n'));
  expect(sections).toHaveLength(2);
  for (const section of sections) {
    expect(Number.parseFloat(section.label), `${section.name} label "${section.label}"`).toBeGreaterThan(0);
    expect(section.value, `${section.name} value`).toBeGreaterThan(0);
  }
});

Then(
  'the pie chart splits the total payment into the principal and the interest I calculated',
  async function (this: TestWorld) {
    const terms = termsOf(this);
    const expected = loanTotals(terms);
    const sections = await this.emiCalculator.pieChart.sections();
    const principal = sections.find((s) => s.name === 'Principal Loan Amount');
    const interest = sections.find((s) => s.name === 'Total Interest');
    expect(principal, 'Principal Loan Amount slice').toBeDefined();
    expect(interest, 'Total Interest slice').toBeDefined();

    expect(principal!.value).toBe(terms.principal);
    expect(Math.abs(interest!.value - expected.totalInterest)).toBeLessThanOrEqual(1);

    // The labels show one decimal place.
    const principalShare = (terms.principal / expected.totalPayment) * 100;
    expect(Math.abs(Number.parseFloat(principal!.label) - principalShare)).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(Math.abs(Number.parseFloat(interest!.label) - (100 - principalShare))).toBeLessThanOrEqual(0.05 + 1e-9);
  },
);

Then('the payment schedule bar chart is visible', async function (this: TestWorld) {
  const { barChart } = this.emiCalculator;
  await barChart.container.scrollIntoViewIfNeeded();
  await expect(barChart.container).toBeVisible();
  await expect(await barChart.bars('Principal')).not.toHaveCount(0);
  await expect(await barChart.bars('Interest')).not.toHaveCount(0);
  await barChart.settled();
  await this.screenshot('bar chart', barChart.container);
});

Then(
  'the bar chart has {int} bars, one for each year from {int} to {int}',
  async function (this: TestWorld, count: number, firstYear: number, lastYear: number) {
    const { barChart } = this.emiCalculator;
    const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => String(firstYear + i));
    // toHaveText retries, which also waits for the redraw after the start month changed.
    await expect(barChart.yearLabels).toHaveText(years);
    await expect(await barChart.bars('Principal')).toHaveCount(count);
    await expect(await barChart.bars('Interest')).toHaveCount(count);

    const schedule = yearlySchedule(termsOf(this), this.scheduleStart!);
    expect(schedule.map((year) => String(year.year)), 'calendar years in my own schedule').toEqual(years);
    this.attach(
      `${count} bars (${firstYear}-${lastYear}). Each bar stacks a Principal and an Interest segment, ` +
        `so the chart draws ${count * 2} segments. Payments per year in my schedule: ` +
        schedule.map((year) => `${year.year}: ${year.months}`).join(', '),
    );
  },
);

Then(
  'the tooltip of the {int} bar shows the principal, interest and total payment from my own schedule',
  async function (this: TestWorld, year: number) {
    const expected = yearlySchedule(termsOf(this), this.scheduleStart!).find((entry) => entry.year === year);
    if (!expected) throw new Error(`My schedule has no payments in ${year}`);
    const { barChart } = this.emiCalculator;

    const principalTip = await barChart.hover('Principal', year);
    await this.screenshot(`tooltip principal ${year}`, barChart.container);
    const interestTip = await barChart.hover('Interest', year);
    await this.screenshot(`tooltip interest ${year}`, barChart.container);
    this.attach(`Principal bar tooltip: ${JSON.stringify(principalTip)}\nInterest bar tooltip: ${JSON.stringify(interestTip)}`);

    expect(principalTip.heading).toBe(`Year : ${year}`);
    expect(interestTip.heading).toBe(`Year : ${year}`);
    const shown = {
      principal: parseRupees(principalTip.values.Principal),
      interest: parseRupees(interestTip.values.Interest),
      totalPayment: parseRupees(principalTip.values['Total Payment']),
    };
    expect(parseRupees(interestTip.values['Total Payment'])).toBe(shown.totalPayment);
    expect(Math.abs(shown.principal - expected.principal), 'principal').toBeLessThanOrEqual(1);
    expect(Math.abs(shown.interest - expected.interest), 'interest').toBeLessThanOrEqual(1);
    expect(Math.abs(shown.totalPayment - expected.totalPayment), 'total payment').toBeLessThanOrEqual(1);
  },
);
