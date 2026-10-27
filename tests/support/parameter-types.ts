import { defineParameterType } from '@cucumber/cucumber';
import { parseIndianAmount } from './money';

// Lets feature files write amounts the way the brief does: 25L, 50L, 1.5Cr.
defineParameterType({
  name: 'amount',
  regexp: /\d[\d,]*(?:\.\d+)?(?:L|Cr)?/,
  transformer: parseIndianAmount,
});

// A whole number that may use thousands separators: 19,619,400.
defineParameterType({
  name: 'number',
  regexp: /\d{1,3}(?:,\d{3})+|\d+/,
  transformer: (text: string) => Number(text.replace(/,/g, '')),
});
