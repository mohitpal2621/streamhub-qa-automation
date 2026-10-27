import type { Locator, Page } from '@playwright/test';
import { toCode, toLocator } from './locator-spec';
import { pageElements } from './page-elements';
import { validate } from './validate';
import type { BrittleLocator, Healer, HealRecord } from './types';

/** Proposals below this confidence are recorded but never used. */
const MIN_CONFIDENCE = 0.5;

export class HealingRefused extends Error {
  constructor(readonly record: HealRecord) {
    super(`No replacement for ${record.selector} (${record.intent}) passed validation`);
  }
}

/**
 * Detect, propose, validate, record. A locator that works is returned as is.
 * A broken one is shown to the healer together with the page's elements; the
 * first proposal that passes validation is used for the rest of this run and
 * written to the heal report as a suggested change. Source files are never
 * edited: a person reviews the report and applies the change.
 */
export class SelfHealing {
  readonly records: HealRecord[] = [];

  constructor(
    private readonly page: Page,
    private readonly options: { enabled: boolean; healer: Healer; scenario: string; probeTimeout: number },
  ) {}

  async locate(target: BrittleLocator, step: string): Promise<Locator> {
    const original = this.page.locator(target.selector);
    const visible = await original
      .first()
      .waitFor({ state: 'visible', timeout: this.options.probeTimeout })
      .then(() => true, () => false);
    const matches = await original.count();
    if ((visible && matches === 1) || !this.options.enabled) return original;

    const record: HealRecord = {
      key: target.key,
      scenario: this.options.scenario,
      step,
      selector: target.selector,
      intent: target.intent,
      why: target.why,
      matches,
      healer: this.options.healer.name,
      proposals: [],
      outcome: 'refused',
      confirmedAfterAction: false,
    };
    this.records.push(record);

    const proposals = await this.options.healer.propose({ target, step, matches, elements: await pageElements(this.page) });
    for (const proposal of proposals) {
      const checks = await validate(this.page, proposal.spec, target.expect);
      checks.unshift({
        name: `confidence of at least ${MIN_CONFIDENCE}`,
        passed: proposal.confidence >= MIN_CONFIDENCE,
        detail: String(proposal.confidence),
      });
      const accepted = checks.every((check) => check.passed);
      record.proposals.push({ ...proposal, code: toCode(proposal.spec), checks, accepted });
      if (accepted) {
        record.outcome = 'healed';
        record.replacement = toCode(proposal.spec);
        return toLocator(this.page, proposal.spec);
      }
    }
    throw new HealingRefused(record);
  }

  /** Call once the step has checked that the action had its effect, e.g. the tab really switched. */
  confirm(target: BrittleLocator): void {
    const record = this.records.findLast((r) => r.key === target.key);
    if (record) record.confirmedAfterAction = true;
  }
}
