import type { Locator, Page } from '@playwright/test';
import type { LocatorSpec } from './types';

type Role = Parameters<Page['getByRole']>[0];

export function toLocator(page: Page, spec: LocatorSpec): Locator {
  switch (spec.strategy) {
    case 'role':
      return page.getByRole(spec.role as Role, { name: spec.name, exact: spec.exact });
    case 'label':
      return page.getByLabel(spec.text, { exact: spec.exact });
    case 'text':
      return page.getByText(spec.text, { exact: spec.exact });
    case 'testid':
      return page.getByTestId(spec.value);
    case 'css':
      return page.locator(spec.selector);
  }
}

const quote = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** The replacement as a line of test code, for the suggested change in the report. */
export function toCode(spec: LocatorSpec): string {
  switch (spec.strategy) {
    case 'role':
      return `page.getByRole(${quote(spec.role)}, { name: ${quote(spec.name)}, exact: ${spec.exact} })`;
    case 'label':
      return `page.getByLabel(${quote(spec.text)}, { exact: ${spec.exact} })`;
    case 'text':
      return `page.getByText(${quote(spec.text)}, { exact: ${spec.exact} })`;
    case 'testid':
      return `page.getByTestId(${quote(spec.value)})`;
    case 'css':
      return `page.locator(${quote(spec.selector)})`;
  }
}

/**
 * A replacement that depends on DOM position would recreate the brittleness
 * it is meant to fix, so those are rejected outright.
 */
export function positionalReason(spec: LocatorSpec): string | undefined {
  if (spec.strategy !== 'css') return undefined;
  if (/^(xpath=|\/|\()/.test(spec.selector)) return 'XPath selectors are not accepted';
  if (/:nth-(child|of-type|last-child)|:(first|last)-(child|of-type)|>>\s*nth=/.test(spec.selector)) {
    return 'selects by position in the DOM';
  }
  return undefined;
}
