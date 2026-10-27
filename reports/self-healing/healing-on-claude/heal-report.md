# Self-healing report

Healer: claude (claude-opus-5-5 via Claude Code). Generated 2026-10-27T18:40:46.811Z.

Nothing here has been applied to the source. Each healed locator below is a suggested change for a person to review.

| Locator | Broken selector | Outcome | Replacement | Confirmed by the step |
| --- | --- | --- | --- | --- |
| personalLoanTab | `xpath=/html/body/div[1]/div[3]/div/div[1]/div[1]/ul/li[2]/a` | healed | `page.getByRole('link', { name: 'Personal Loan', exact: true })` | yes |
| loanAmount | `#personal-loan-amount` | healed | `page.getByRole('textbox', { name: 'Personal Loan Amount', exact: true })` | yes |
| interestRate | `input[name="interest_rate"]` | healed | `page.getByRole('textbox', { name: 'Interest Rate', exact: true })` | yes |
| emiValue | `#emipaymentsummary > div:nth-child(1) > p > span:nth-child(2)` | healed | `page.locator('#emiamount p span')` | yes |
| calculateButton | `role=button[name="Calculate EMI"]` | refused | - | no |

## personalLoanTab

- Step: open the Personal Loan tab (scenario "Work out a personal loan EMI through four broken locators")
- Wanted: the "Personal Loan" tab at the top of the loan calculator
- Broken selector: `xpath=/html/body/div[1]/div[3]/div/div[1]/div[1]/ul/li[2]/a` matched 0 element(s)
- Why it broke: An absolute XPath of the kind "Copy XPath" in DevTools produces. Every index depends on the layout above the calculator (ad slots, wrapper divs), so any change there breaks it. This one no longer matches anything.

1. `page.getByRole('link', { name: 'Personal Loan', exact: true })` (confidence 0.95) - **accepted**
   - Healer's reason: Only link with accessible name exactly 'Personal Loan' (ref 8), inside the calculator tab li#personal-loan.
   - PASS confidence of at least 0.5
   - PASS not positional
   - PASS matches exactly one element
   - PASS visible
   - PASS role is link
   - PASS accessible name matches /^Personal Loan$/

Suggested change in `tests/pages/BrittleEmiCalculatorPage.ts`:

```diff
- selector: 'xpath=/html/body/div[1]/div[3]/div/div[1]/div[1]/ul/li[2]/a',
+ page.getByRole('link', { name: 'Personal Loan', exact: true })
```

## loanAmount

- Step: type the loan amount (scenario "Work out a personal loan EMI through four broken locators")
- Wanted: the "Personal Loan Amount" text box
- Broken selector: `#personal-loan-amount` matched 0 element(s)
- Why it broke: A plausible id guessed from the label text, the kind an AI assistant writes without looking at the DOM. The real id is "loanamount".

1. `page.getByRole('textbox', { name: 'Personal Loan Amount', exact: true })` (confidence 0.95) - **accepted**
   - Healer's reason: ref 10: input textbox with accessible name 'Personal Loan Amount', unique match
   - PASS confidence of at least 0.5
   - PASS not positional
   - PASS matches exactly one element
   - PASS visible
   - PASS role is textbox
   - PASS accessible name matches /Loan Amount/
   - PASS editable

Suggested change in `tests/pages/BrittleEmiCalculatorPage.ts`:

```diff
- selector: '#personal-loan-amount',
+ page.getByRole('textbox', { name: 'Personal Loan Amount', exact: true })
```

## interestRate

- Step: type the interest rate (scenario "Work out a personal loan EMI through four broken locators")
- Wanted: the "Interest Rate" text box
- Broken selector: `input[name="interest_rate"]` matched 0 element(s)
- Why it broke: A guessed snake_case name attribute. The page uses name="loaninterest".

1. `page.getByRole('textbox', { name: 'Interest Rate', exact: true })` (confidence 0.96) - **accepted**
   - Healer's reason: Ref 11 is an input with role textbox and accessible name 'Interest Rate'. No other textbox has this exact name.
   - PASS confidence of at least 0.5
   - PASS not positional
   - PASS matches exactly one element
   - PASS visible
   - PASS role is textbox
   - PASS accessible name matches /Interest Rate/
   - PASS editable

Suggested change in `tests/pages/BrittleEmiCalculatorPage.ts`:

```diff
- selector: 'input[name="interest_rate"]',
+ page.getByRole('textbox', { name: 'Interest Rate', exact: true })
```

## emiValue

- Step: read the monthly EMI (scenario "Work out a personal loan EMI through four broken locators")
- Wanted: the monthly EMI amount under the "Loan EMI" heading
- Broken selector: `#emipaymentsummary > div:nth-child(1) > p > span:nth-child(2)` matched 0 element(s)
- Why it broke: Positional CSS that is off by one: the ₹ sign before the amount is a text node, not an element, so the amount is the first span in the paragraph, not the second.

1. `page.locator('#emiamount p span')` (confidence 0.9) - **accepted**
   - Healer's reason: Span 22,244 (ref 141) inside the #emiamount block under the 'Loan EMI' heading. The stable id scopes it, and the text matches the required pattern.
   - PASS confidence of at least 0.5
   - PASS not positional
   - PASS matches exactly one element
   - PASS visible
   - PASS text matches /^₹?\s?\d{1,3}(,\d{2,3})*$/

Suggested change in `tests/pages/BrittleEmiCalculatorPage.ts`:

```diff
- selector: '#emipaymentsummary > div:nth-child(1) > p > span:nth-child(2)',
+ page.locator('#emiamount p span')
```

## calculateButton

- Step: click Calculate EMI (scenario "A locator for a button the page does not have is not healed")
- Wanted: a "Calculate EMI" button that recalculates the loan
- Broken selector: `role=button[name="Calculate EMI"]` matched 0 element(s)
- Why it broke: There is no such button: the calculator recalculates when a field loses focus. Nothing on the page should be accepted in its place.

The healer proposed nothing.
