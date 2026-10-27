import type { Page } from '@playwright/test';
import type { PageElement } from './types';

/**
 * A compact list of the visible elements on the page: interactive ones first,
 * then headings and labels, then short text. This is the healers' view of the
 * page. It is much smaller than the HTML, so it fits comfortably in a prompt.
 */
export function pageElements(page: Page, limit = 250): Promise<PageElement[]> {
  return page.evaluate((max) => {
    const IMPLICIT_ROLES: Record<string, string> = {
      a: 'link',
      button: 'button',
      select: 'combobox',
      textarea: 'textbox',
      h1: 'heading',
      h2: 'heading',
      h3: 'heading',
      h4: 'heading',
      h5: 'heading',
      h6: 'heading',
    };
    const INPUT_ROLES: Record<string, string> = { checkbox: 'checkbox', radio: 'radio', button: 'button', submit: 'button' };
    const clean = (text?: string | null) => (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || undefined;

    const roleOf = (el: Element) => {
      const tag = el.tagName.toLowerCase();
      if (el.getAttribute('role')) return el.getAttribute('role')!;
      if (tag === 'input') return INPUT_ROLES[(el as HTMLInputElement).type] ?? 'textbox';
      if (tag === 'a' && !el.hasAttribute('href')) return undefined;
      return IMPLICIT_ROLES[tag];
    };
    const labelOf = (el: Element) => {
      const byFor = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
      return clean((byFor ?? el.closest('label'))?.textContent);
    };
    const contextOf = (el: Element) => {
      let node = el.parentElement;
      for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
        for (const heading of node.querySelectorAll('h1, h2, h3, h4, h5, h6, label')) {
          const before = heading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING;
          if (heading !== el && !heading.contains(el) && before) return clean(heading.textContent);
        }
      }
      return undefined;
    };
    const visible = (el: Element) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    const interactive = 'a, button, input, select, textarea, [role], [data-testid]';
    const structure = 'h1, h2, h3, h4, h5, h6, label';
    const text = 'p, span, li, td, th';
    const seen = new Set<Element>();
    const elements: Omit<PageElement, 'ref'>[] = [];

    for (const selector of [interactive, structure, text]) {
      for (const el of document.querySelectorAll(selector)) {
        if (elements.length >= max || seen.has(el) || !visible(el)) continue;
        seen.add(el);
        const tag = el.tagName.toLowerCase();
        const content = clean(el.textContent);
        // Plain text elements are only useful as leaves with something to say.
        if (selector === text && (!content || el.children.length > 1)) continue;
        if (tag === 'input' && (el as HTMLInputElement).type === 'hidden') continue;

        const label = ['input', 'select', 'textarea'].includes(tag) ? labelOf(el) : undefined;
        elements.push({
          tag,
          role: roleOf(el),
          name: clean(el.getAttribute('aria-label')) ?? label ?? (['input', 'select', 'textarea'].includes(tag) ? undefined : content),
          id: el.id || undefined,
          nameAttr: el.getAttribute('name') ?? undefined,
          type: el.getAttribute('type') ?? undefined,
          label,
          text: ['input', 'select', 'textarea'].includes(tag) ? undefined : content,
          value: tag === 'input' ? clean((el as HTMLInputElement).value) : undefined,
          testId: el.getAttribute('data-testid') ?? undefined,
          context: contextOf(el),
          scopeId: el.parentElement?.closest('[id]')?.id || undefined,
        });
      }
    }
    return elements.map((element, ref) => ({ ref, ...element }));
  }, limit);
}
