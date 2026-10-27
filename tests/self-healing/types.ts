/**
 * A replacement locator in a form that can be checked before use. Healers
 * return these instead of code, so nothing a model writes is ever executed.
 */
export type LocatorSpec =
  | { strategy: 'role'; role: string; name: string; exact: boolean }
  | { strategy: 'label'; text: string; exact: boolean }
  | { strategy: 'text'; text: string; exact: boolean }
  | { strategy: 'testid'; value: string }
  | { strategy: 'css'; selector: string };

/** What the step knows about the element it wants. Used to validate a replacement. */
export interface Expectation {
  role?: string;
  name?: RegExp;
  text?: RegExp;
  editable?: boolean;
}

export interface BrittleLocator {
  key: string;
  /** The selector exactly as written in the test. */
  selector: string;
  /** What the element is, in words. This goes into the healing prompt. */
  intent: string;
  expect: Expectation;
  /** Why the selector is broken. For the docs and report only; healers never see it. */
  why: string;
}

/** One element of the page as the healers see it. */
export interface PageElement {
  ref: number;
  tag: string;
  role?: string;
  name?: string;
  id?: string;
  nameAttr?: string;
  type?: string;
  label?: string;
  text?: string;
  value?: string;
  testId?: string;
  /** Text of the nearest heading or label above the element. */
  context?: string;
  /** id of the closest ancestor that has one, for scoped CSS such as "#emiamount span". */
  scopeId?: string;
}

export interface HealRequest {
  target: BrittleLocator;
  step: string;
  matches: number;
  elements: PageElement[];
}

export interface Proposal {
  spec: LocatorSpec;
  confidence: number;
  reason: string;
}

export interface Healer {
  name: string;
  propose(request: HealRequest): Promise<Proposal[]>;
}

export interface Check {
  name: string;
  passed: boolean;
  detail: string;
}

export interface HealRecord {
  key: string;
  scenario: string;
  step: string;
  selector: string;
  intent: string;
  why: string;
  matches: number;
  healer: string;
  proposals: (Proposal & { code: string; checks: Check[]; accepted: boolean })[];
  outcome: 'healed' | 'refused';
  replacement?: string;
  confirmedAfterAction: boolean;
}
