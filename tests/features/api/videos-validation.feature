@api
Feature: Videos endpoint rejects bad query parameters
  Every invalid parameter gets a 400 with an error body that names the
  parameter, instead of being ignored or causing a 500.

  Background:
    Given the catalogue API is running

  Scenario Outline: Reject <case>
    When I request "/videos?<query>"
    Then the response status is 400
    And the response matches the API contract
    And the error code is "<code>"
    And the error points at the "<parameter>" parameter

    Examples: Out-of-range numbers
      | case                    | query                     | code              | parameter |
      | a limit of zero         | limit=0                   | INVALID_PARAMETER | limit     |
      | a limit above 50        | limit=51                  | INVALID_PARAMETER | limit     |
      | a page of zero          | page=0                    | INVALID_PARAMETER | page      |
      | a negative page         | page=-1                   | INVALID_PARAMETER | page      |
      | a page above 10000      | page=10001                | INVALID_PARAMETER | page      |
      | a negative duration     | minDuration=-5            | INVALID_PARAMETER | minDuration |
      | a number too big to use | limit=99999999999999999999 | INVALID_PARAMETER | limit    |

    Examples: Unsupported types and formats
      | case                       | query              | code              | parameter |
      | a word for a limit         | limit=ten          | INVALID_PARAMETER | limit     |
      | a decimal page             | page=1.5           | INVALID_PARAMETER | page      |
      | an empty limit             | limit=             | INVALID_PARAMETER | limit     |
      | a live flag of "yes"       | live=yes           | INVALID_PARAMETER | live      |
      | a live flag of "1"         | live=1             | INVALID_PARAMETER | live      |
      | an impossible date         | from=2026-02-30    | INVALID_PARAMETER | from      |
      | a date in DD-MM-YYYY order | to=01-03-2026      | INVALID_PARAMETER | to        |
      | a malformed channel id     | channelId=CH-1     | INVALID_PARAMETER | channelId |

    Examples: Values outside the allowed set
      | case                          | query                  | code              | parameter |
      | an unsupported sort field     | sort=rating            | INVALID_PARAMETER | sort      |
      | an unknown category           | category=cooking       | INVALID_PARAMETER | category  |
      | one unknown category in a list | category=music,cooking | INVALID_PARAMETER | category  |
      | a category in the wrong case  | category=Music         | INVALID_PARAMETER | category  |
      | a one-letter search           | q=a                    | INVALID_PARAMETER | q         |
      | a search of only spaces       | q=%20%20%20            | INVALID_PARAMETER | q         |

    Examples: Ranges that contradict themselves
      | case                          | query                           | code              | parameter   |
      | minDuration above maxDuration | minDuration=600&maxDuration=300 | INVALID_PARAMETER | maxDuration |
      | from later than to            | from=2026-05-01&to=2026-04-01   | INVALID_PARAMETER | to          |

    Examples: Parameters the endpoint does not take
      | case                     | query            | code              | parameter |
      | a misspelt parameter     | sortBy=views     | UNKNOWN_PARAMETER | sortBy    |
      | a parameter given twice  | limit=5&limit=10 | INVALID_PARAMETER | limit     |

  Scenario: A search term longer than 100 characters is rejected
    When I request "/videos" with "q" set to 101 "a" characters
    Then the response status is 400
    And the response matches the API contract
    And the error points at the "q" parameter

  Scenario: A search term of exactly 100 characters is accepted
    When I request "/videos" with "q" set to 100 "a" characters
    Then the response status is 200
    And the response matches the API contract
    And the page contains 0 items

  Scenario: Every problem in a request is reported in one response
    When I request "/videos?limit=0&page=zero&colour=red"
    Then the response status is 400
    And the response matches the API contract
    And the error message is "3 problems with the request: colour, page, limit"
    And the error details are:
      | parameter | code              | value |
      | colour    | UNKNOWN_PARAMETER |       |
      | page      | INVALID_PARAMETER | zero  |
      | limit     | INVALID_PARAMETER | 0     |

  Scenario: The error message says what a valid value looks like
    When I request "/videos?limit=500"
    Then the response status is 400
    And the response matches the API contract
    And the error message is "limit must be an integer between 1 and 50"
