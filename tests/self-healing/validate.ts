import { expect, type Locator, type Page } from '@playwright/test';
import { positionalReason, toLocator } from './locator-spec';
import type { Check, Expectation, LocatorSpec } from './types';

type Role = Parameters<Page['getByRole']>[0];

async function check(name: string, assertion: () => Promise<unknown>): Promise<Check> {
  try {
    await assertion();
    return { name, passed: true, detail: 'ok' };
  } catch (error) {
    const firstLine = (error instanceof Error ? error.message : String(error)).split('\n')[0];
    return { name, passed: false, detail: firstLine.replace(/\u001b\[\d+m/g, '') };
  }
}

/**
 * The gate every proposed locator has to pass before a step may use it:
 * no positional selectors, exactly one match, visible, and the role, name,
 * text or editability the step expects. Checks stop at the first structural
 * failure because later ones would only repeat it.
 */
export async function validate(page: Page, spec: LocatorSpec, expected: Expectation): Promise<Check[]> {
  const positional = positionalReason(spec);
  const checks: Check[] = [{ name: 'not positional', passed: !positional, detail: positional ?? 'ok' }];
  if (positional) return checks;
  // When the step reads a value (an EMI amount), finding the element by that
  // value's text works today and breaks as soon as the value changes.
  if (expected.text && spec.strategy === 'text') {
    return [...checks, { name: 'not found by the value it shows', passed: false, detail: `"${spec.text}" is the value being read` }];
  }

  let locator: Locator;
  try {
    locator = toLocator(page, spec);
  } catch (error) {
    return [...checks, { name: 'valid locator', passed: false, detail: String(error) }];
  }
  const count = await locator.count().catch(() => -1);
  checks.push({ name: 'matches exactly one element', passed: count === 1, detail: `${count === -1 ? 'invalid' : count} match(es)` });
  if (count !== 1) return checks;

  const options = { timeout: 1000 };
  checks.push(await check('visible', () => expect(locator).toBeVisible(options)));
  if (expected.role) {
    checks.push(await check(`role is ${expected.role}`, () => expect(locator).toHaveRole(expected.role as Role, options)));
  }
  if (expected.name) {
    checks.push(await check(`accessible name matches ${expected.name}`, () => expect(locator).toHaveAccessibleName(expected.name!, options)));
  }
  if (expected.text) {
    checks.push(await check(`text matches ${expected.text}`, () => expect(locator).toHaveText(expected.text!, options)));
  }
  if (expected.editable) {
    checks.push(await check('editable', () => expect(locator).toBeEditable(options)));
  }
  return checks;
}
