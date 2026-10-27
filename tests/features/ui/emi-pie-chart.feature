@ui
Feature: Home loan EMI and the payment break-up pie chart
  Test case 1 from the brief. The calculator's EMI, total interest and total
  payment should equal the reducing-balance formula worked out in the test
  code, and the pie chart should show both parts of the total payment.

  Background:
    Given I open the EMI calculator
    And I open the "Home Loan" tab

  Scenario Outline: <scenario>: <amount> at <rate>% for <years> years
    When I enter a loan amount of <amount>, an interest rate of <rate>% and a tenure of <years> years
    Then the EMI, total interest and total payment match my own calculation
    And the payment break-up pie chart is visible
    And both sections of the pie chart show values greater than zero
    And the pie chart splits the total payment into the principal and the interest I calculated

    Examples:
      | scenario   | amount | rate | years |
      | Scenario A | 25L    | 10   | 10    |
      | Scenario B | 50L    | 7.5  | 15    |
