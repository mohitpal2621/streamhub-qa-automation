import { toCode } from './locator-spec';
import type { Healer, HealRequest, LocatorSpec, PageElement, Proposal } from './types';

// Words that say nothing about which element is meant.
const NOISE = new Set(['the', 'an', 'at', 'of', 'and', 'in', 'on', 'to', 'that', 'html', 'body', 'div', 'ul', 'li', 'span', 'xpath', 'nth', 'child', 'name', 'role', 'input', 'box', 'text', 'under']);
const NAMED_ROLES = new Set(['link', 'button', 'textbox', 'combobox', 'checkbox', 'radio', 'tab', 'heading', 'menuitem']);

const words = (text?: string) =>
  (text ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !NOISE.has(word));

/** The most robust way to point at this element, in the order the docs recommend. */
function locatorFor(element: PageElement): LocatorSpec {
  if (element.role && element.name && NAMED_ROLES.has(element.role)) {
    return { strategy: 'role', role: element.role, name: element.name, exact: true };
  }
  if (element.label) return { strategy: 'label', text: element.label, exact: true };
  if (element.testId) return { strategy: 'testid', value: element.testId };
  if (element.id) return { strategy: 'css', selector: `#${element.id}` };
  if (element.scopeId) return { strategy: 'css', selector: `#${element.scopeId} ${element.tag}` };
  return { strategy: 'text', text: element.text ?? '', exact: true };
}

/**
 * Offline healer. It scores each element on the page by:
 * - the share of words it has in common with the intent and broken selector,
 * - a quoted phrase from the intent ("Loan EMI") appearing as its name,
 *   label, text or nearest heading, which is the strongest single signal,
 * - having the role and kind of text the step expects.
 * No network and deterministic, so the detect / propose / validate loop can be
 * shown without an API key.
 */
export const heuristicHealer: Healer = {
  name: 'heuristic',
  async propose({ target, elements }: HealRequest): Promise<Proposal[]> {
    const wanted = new Set([...words(target.intent), ...words(target.selector)]);
    const phrases = [...target.intent.matchAll(/"([^"]+)"/g)].map((match) => match[1].toLowerCase());
    const { role, text, editable } = target.expect;
    const scoped = (element: PageElement) => elements.filter((e) => e.scopeId === element.scopeId && e.tag === element.tag).length;

    const ranked = elements
      .map((element) => {
        const fields = [element.name, element.label, element.text, element.context].map((field) => field?.toLowerCase());
        const own = new Set(words([...fields, element.id, element.nameAttr, element.testId].join(' ')));
        const shared = [...wanted].filter((word) => own.has(word));
        let score = shared.length / Math.max(wanted.size, 1);
        if (phrases.some((phrase) => fields.includes(phrase))) score += 0.5;
        if (role) score += element.role === role ? 0.2 : -0.5;
        if (text) score += text.test(element.text ?? '') ? 0.2 : -0.5;
        if (editable && !['input', 'textarea', 'select'].includes(element.tag)) score -= 0.5;
        return { element, spec: locatorFor(element), score: Math.min(score, 1), shared };
      })
      // "#scope tag" only identifies the element when it is the only such tag in that scope.
      .filter(({ element, spec, score }) => score > 0 && !(spec.strategy === 'css' && !element.id && scoped(element) > 1))
      .sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    return ranked
      .filter(({ spec }) => !seen.has(toCode(spec)) && seen.add(toCode(spec)))
      .slice(0, 3)
      .map(({ element, spec, score, shared }) => ({
        spec,
        confidence: Math.round(score * 100) / 100,
        reason: `<${element.tag}> "${element.name ?? element.text ?? element.id}" shares ${shared.join(', ') || 'no words'} with the intent`,
      }));
  },
};
