/**
 * Loan maths used as the test oracle. It is written from the textbook formula,
 * not copied from emicalculator.net, so the tests compare two independent
 * calculations.
 */

export interface LoanTerms {
  principal: number;
  annualRatePercent: number;
  tenureMonths: number;
}

export interface LoanTotals {
  emi: number;
  totalInterest: number;
  totalPayment: number;
}

export interface YearOfPayments {
  year: number;
  months: number;
  principal: number;
  interest: number;
  totalPayment: number;
  closingBalance: number;
}

const monthlyRate = (terms: LoanTerms) => terms.annualRatePercent / 12 / 100;

/** Reducing-balance EMI: P * r * (1 + r)^n / ((1 + r)^n - 1), with r the monthly rate. */
export function monthlyEmi(terms: LoanTerms): number {
  const r = monthlyRate(terms);
  if (r === 0) return terms.principal / terms.tenureMonths;
  const growth = (1 + r) ** terms.tenureMonths;
  return (terms.principal * r * growth) / (growth - 1);
}

export function loanTotals(terms: LoanTerms): LoanTotals {
  const emi = monthlyEmi(terms);
  const totalPayment = emi * terms.tenureMonths;
  return { emi, totalPayment, totalInterest: totalPayment - terms.principal };
}

/**
 * Amortisation schedule summed per calendar year. The first EMI is paid in
 * `start.month` (1-12) of `start.year`, which is how the calculator's
 * "Schedule showing EMI payments starting from" field behaves.
 */
export function yearlySchedule(terms: LoanTerms, start: { year: number; month: number }): YearOfPayments[] {
  const emi = monthlyEmi(terms);
  const r = monthlyRate(terms);
  const years = new Map<number, YearOfPayments>();
  let balance = terms.principal;

  for (let i = 0; i < terms.tenureMonths; i++) {
    const year = start.year + Math.floor((start.month - 1 + i) / 12);
    const interest = balance * r;
    const principal = emi - interest;
    balance -= principal;

    const entry = years.get(year) ?? { year, months: 0, principal: 0, interest: 0, totalPayment: 0, closingBalance: 0 };
    entry.months += 1;
    entry.principal += principal;
    entry.interest += interest;
    entry.totalPayment += emi;
    entry.closingBalance = Math.max(balance, 0);
    years.set(year, entry);
  }
  return [...years.values()];
}
