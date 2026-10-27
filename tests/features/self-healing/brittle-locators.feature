@ui @self-healing
Feature: Self-healing demo with deliberately broken locators
  tests/pages/BrittleEmiCalculatorPage.ts holds five locators that are broken on
  purpose; docs/self-healing-locators.md explains each one. With healing off
  (npm run test:healing:off) the first scenario fails at the first broken
  locator. With healing on (npm run test:healing) each broken locator is
  detected, a replacement is proposed and validated, and every decision is
  written to heal-report.md for review.

  Scenario: Work out a personal loan EMI through four broken locators
    Given I open the EMI calculator
    When I open the Personal Loan tab through its brittle locator
    And I type 10L into the loan amount box through its brittle locator
    And I type 12% into the interest rate box through its brittle locator
    And I set the tenure to 5 years
    Then the EMI read through its brittle locator matches my own calculation

  Scenario: A locator for a button the page does not have is not healed
    Given I open the EMI calculator
    Then clicking the "Calculate EMI" button through its brittle locator fails
    And no replacement was accepted for the "calculateButton" locator
