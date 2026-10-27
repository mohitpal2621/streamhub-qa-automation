# Self-healing locators with AI

This covers the self-healing part of the brief: five deliberately broken locators, how I would detect and repair them with an LLM, and how a repair is checked before a test is allowed to use it. There is a working proof of concept in `tests/self-healing/`, and its reports are committed.

```bash
npm run test:healing:off      # the broken locators as written: the first scenario fails
npm run test:healing          # offline heuristic healer, no API key needed
npm run test:healing:claude   # Claude as the healer (Claude API key, or a logged-in Claude Code)
```

## The broken locators

They live in [`tests/pages/BrittleEmiCalculatorPage.ts`](../tests/pages/BrittleEmiCalculatorPage.ts) and are used only by [`brittle-locators.feature`](../tests/features/self-healing/brittle-locators.feature), so the main UI suite stays green. Each one is a common way for a locator to break.

| Key | Broken selector | Meant to find | Why it is broken |
| --- | --- | --- | --- |
| `personalLoanTab` | `xpath=/html/body/div[1]/div[3]/div/div[1]/div[1]/ul/li[2]/a` | the Personal Loan tab | Absolute XPath from DevTools' "Copy XPath". Any change to the wrappers and ad slots above the calculator shifts the indexes; this one matches nothing. |
| `loanAmount` | `#personal-loan-amount` | the loan amount box | An id guessed from the label, which is what an AI assistant writes when it has not looked at the DOM. The real id is `loanamount`. |
| `interestRate` | `input[name="interest_rate"]` | the interest rate box | A guessed snake_case `name`. The page uses `loaninterest`. |
| `emiValue` | `#emipaymentsummary > div:nth-child(1) > p > span:nth-child(2)` | the EMI amount | Positional CSS, off by one. The `₹` before the amount is a text node rather than an element, so the amount is the first span, not the second. |
| `calculateButton` | `role=button[name="Calculate EMI"]` | a Calculate button | The page has no such button; it recalculates when a field loses focus. The right outcome here is no repair at all. |

## Detection

Healing starts from one rule: a locator is broken when it does not resolve to exactly one visible element. [`SelfHealing.locate()`](../tests/self-healing/SelfHealing.ts) checks this with a short probe (2 seconds) before the step acts, rather than waiting for the action to hit its full timeout. A locator that works is returned untouched, so healing costs nothing on a healthy run.

When the probe fails, the healer gets:

- the broken selector and the step that used it,
- what the element is for, in words (`intent`), written next to the selector in the page object,
- what the step needs from it: a role, an accessible name, a text pattern, or that it is editable,
- a compact list of the visible elements on the page ([`page-elements.ts`](../tests/self-healing/page-elements.ts)): tag, role, accessible name, id, name attribute, label, text, the nearest heading above it, and the id of its closest ancestor that has one.

The element list rather than the raw HTML: the emicalculator.net page is about 250 KB of HTML, mostly articles and ad markup, while the list is capped at 250 entries and holds what a locator can be built from. The intent matters as much as the selector. `#personal-loan-amount` hints at what it wanted, but `span:nth-child(2)` says nothing, and without "the EMI amount under the Loan EMI heading" no healer could know which number on the page was meant.

Healing only ever runs for a locator that cannot find its element. An assertion that fails on an element that was found is left alone, because that can be a real bug, and repairing the locator would hide it.

## Prompt approach

[`claude-healer.ts`](../tests/self-healing/claude-healer.ts) sends one request per broken locator. The system prompt sets the rules a reviewer would apply anyway:

- prefer role and accessible name, then label, then test id, then exact visible text;
- CSS only when anchored on a stable id, never `:nth-child` and never XPath;
- use only names, ids and text that appear in the element list;
- if nothing on the page is what the test wanted, return an empty list, because an empty list is a correct answer and a near miss is not;
- give a confidence (0 to 1) and a one-line reason for each candidate.

The answer is constrained by a JSON schema (structured output), so it is always a list of `{ strategy, value, role, exact, confidence, reason }`. The healer turns each item into a `LocatorSpec` and builds the Playwright locator itself. Nothing the model writes is executed as code.

The model is `claude-opus-5-5` by default (`HEALER_MODEL` changes it). There are two ways to reach it:

- With `ANTHROPIC_API_KEY` set, the healer calls the Claude API through `@anthropic-ai/sdk`. This is the path for CI. I have not run it against the live API, because this machine has no API key; it type-checks against the SDK's own types.
- Without a key, it runs a local Claude Code install in print mode (`claude -p --output-format json --json-schema ...`). That is how the committed Claude run was produced. By default Claude Code loads its tools, MCP servers, user settings and skills, which put about 55,000 tokens of context in front of a one-line test question; `--tools "" --strict-mcp-config --setting-sources local --disable-slash-commands` brings that down to about 1,400.

The offline [heuristic healer](../tests/self-healing/heuristic-healer.ts) answers the same question without a model. It scores elements by words shared with the intent and selector, by a quoted phrase from the intent ("Loan EMI") appearing as the element's name or nearest heading, and by role and text fit. It exists so the whole loop can be run and reviewed without a key.

## Validation before a fix is used

Every proposal goes through [`validate.ts`](../tests/self-healing/validate.ts) before a step may use it, whichever healer proposed it. A proposal is accepted only if all of these pass:

1. confidence of at least 0.5;
2. not positional: no XPath, no `nth-child` or similar;
3. not found by the value it shows: when the step reads a number, a `getByText('22,244')` locator works today and breaks when the number changes;
4. exactly one match on the live page;
5. visible;
6. the expected role, accessible name, text pattern or editability, checked with Playwright's own `toHaveRole`, `toHaveAccessibleName`, `toHaveText` and `toBeEditable`.

The first proposal that passes is used for the rest of that run. After the action the step makes its normal assertion (the tab switched, the box shows the typed amount, the EMI equals my calculation), and only then is the repair marked as confirmed.

Source files are never changed. Each run writes `heal-report.md` and `heal-report.json` with the broken selector, every proposal with its checks, the accepted replacement and a suggested diff for the page object. A person reviews that and makes the change in a normal pull request. In a CI setup I would let a healed run pass, mark it as healed, and open a ticket for each repair, so a suite cannot quietly run on patched locators for months.

## What the proof of concept did

| Run | Result | Report |
| --- | --- | --- |
| Healing off | First scenario fails at the Personal Loan tab (`locator.click: Timeout 5000ms exceeded`); the Calculate button scenario passes because it expects the click to fail | [healing-off](../reports/self-healing/healing-off/cucumber-report.html) |
| Heuristic healer | 4 locators repaired and confirmed, the Calculate button refused | [heal-report.md](../reports/self-healing/healing-on/heal-report.md) |
| Claude healer (`claude-opus-5-5`) | 4 locators repaired and confirmed, no proposal at all for the Calculate button | [heal-report.md](../reports/self-healing/healing-on-claude/heal-report.md) |

Claude's replacements, with the confidence it gave:

| Key | Replacement | Confidence |
| --- | --- | --- |
| `personalLoanTab` | `page.getByRole('link', { name: 'Personal Loan', exact: true })` | 0.95 |
| `loanAmount` | `page.getByRole('textbox', { name: 'Personal Loan Amount', exact: true })` | 0.95 |
| `interestRate` | `page.getByRole('textbox', { name: 'Interest Rate', exact: true })` | 0.96 |
| `emiValue` | `page.locator('#emiamount p span')` | 0.9 |
| `calculateButton` | none, the model returned an empty list | |

The first version of the heuristic healer is a good argument for the validation step. For the EMI value it ranked the slider's tick labels ("0", "5", "10") level with the real amount, because they also sit under a heading containing "Loan" and "Amount" and look like numbers. All three of its proposals were `#loanamountsteps span`-style selectors that matched 14 or 18 elements, so the uniqueness check rejected each of them and the step failed loudly instead of reading the wrong number. Scoring quoted phrases from the intent, and skipping scoped selectors that are not unique in the element list, fixed the ranking. For the Calculate button the heuristic offered "Download PDF" with confidence 0.4, and the gate turned it down twice over: too unsure, and no button by that name.

## What I would add for real use

- Cache accepted repairs by broken selector and page, so a broken locator costs one model call rather than one per run.
- Have a bot open the pull request with the suggested diff from `heal-report.json`.
- Track how often each locator heals. A locator that keeps needing repair points at a page that changes a lot, or at a test that should use a test id.
- Strip personal data from the element list before sending it to an external API. The emicalculator.net page has none, but a real application under test would.
- Send a screenshot of the area as well when the DOM alone is ambiguous, for example canvas charts.
