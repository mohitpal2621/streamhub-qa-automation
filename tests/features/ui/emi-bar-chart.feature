@ui
Feature: Personal loan payment schedule bar chart
  Test case 2 from the brief. The loan is set with the sliders, the schedule
  start month is changed in the calendar, and the year-wise bar chart is
  checked against an amortisation schedule computed in the test code.

  Scenario: 10L personal loan at 12% for 5 years, starting June 2027
    Given I open the EMI calculator
    And I open the "Personal Loan" tab
    When I drag the sliders to a loan amount of 10L, an interest rate of 12% and a tenure of 5 years
    And I change the schedule start month to "Jun 2027"
    Then the EMI, total interest and total payment match my own calculation
    And the payment schedule bar chart is visible
    And the bar chart has 6 bars, one for each year from 2027 to 2032
    And the tooltip of the 2028 bar shows the principal, interest and total payment from my own schedule
