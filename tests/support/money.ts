const UNITS: Record<string, number> = { L: 100_000, CR: 10_000_000 };

/**
 * Parses the amounts used in the brief and on emicalculator.net:
 * "25L" -> 2500000, "1.5Cr" -> 15000000, "7,50,000" -> 750000, "12" -> 12.
 */
export function parseIndianAmount(text: string): number {
  const match = /^([\d,]*\.?\d+)\s*(L|Cr)?$/i.exec(text.trim());
  if (!match) throw new Error(`"${text}" is not an amount like 25L, 1.5Cr or 7,50,000`);
  const [, digits, unit] = match;
  return Number(digits.replace(/,/g, '')) * (unit ? UNITS[unit.toUpperCase()] : 1);
}

/** Reads a displayed amount such as "₹ 1,07,96,711" or "₹44,986". */
export function parseRupees(text: string): number {
  const digits = text.replace(/[^\d.]/g, '');
  if (!digits) throw new Error(`No amount found in "${text}"`);
  return Number(digits);
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** 3964522 -> "39,64,522", the grouping the calculator uses. */
export const formatRupees = (amount: number) => inr.format(amount);
