@api
Feature: View statistics endpoint
  GET /stats/views totals views per category, channel or month. groupBy is
  required. The per-group totals are checked against the videos endpoint, so
  the two endpoints have to agree with each other.

  Background:
    Given the catalogue API is running

  Scenario: groupBy is required
    When I request "/stats/views"
    Then the response status is 400
    And the response matches the API contract
    And the error code is "MISSING_PARAMETER"
    And the error points at the "groupBy" parameter

  Scenario Outline: Views grouped by <groupBy>
    When I request "/stats/views?groupBy=<groupBy>"
    Then the response status is 200
    And the response matches the API contract
    And there are <groups> groups covering 30 videos and 19,619,400 views
    And the groups are ordered by views, highest first
    And the group totals add up to the overall totals
    And every group's totals match what the videos endpoint returns for it

    Examples:
      | groupBy  | groups |
      | category | 8      |
      | channel  | 6      |
      | month    | 13     |

  Scenario: Top three categories
    When I request "/stats/views?groupBy=category&top=3"
    Then the response status is 200
    And the response matches the API contract
    And the groups are:
      | key         | label       | videos | views     | averageViews |
      | sports      | sports      | 5      | 4,494,200 | 898,840      |
      | documentary | documentary | 4      | 4,370,500 | 1,092,625    |
      | news        | news        | 4      | 3,217,000 | 804,250      |

  Scenario: Views per channel for March 2026
    When I request "/stats/views?groupBy=channel&from=2026-03-01&to=2026-03-31"
    Then the response status is 200
    And the response matches the API contract
    And there are 5 groups covering 5 videos and 1,631,700 views
    And the groups are:
      | key    | label           | videos | views   | averageViews |
      | ch_003 | Byte Sized Tech | 1      | 764,000 | 764,000      |
      | ch_001 | Pitchside Live  | 1      | 486,000 | 486,000      |
      | ch_004 | The Daily Brief | 1      | 176,800 | 176,800      |
      | ch_002 | Northern Beats  | 1      | 128,400 | 128,400      |
      | ch_006 | Wild Frontiers  | 1      | 76,500  | 76,500       |
    And every group's totals match what the videos endpoint returns for it

  Scenario: A date range with no videos gives empty groups
    When I request "/stats/views?groupBy=month&from=2027-01-01"
    Then the response status is 200
    And the response matches the API contract
    And there are 0 groups covering 0 videos and 0 views

  Scenario Outline: Reject <case>
    When I request "/stats/views?<query>"
    Then the response status is 400
    And the response matches the API contract
    And the error code is "<code>"
    And the error points at the "<parameter>" parameter

    Examples:
      | case                     | query                                      | code              | parameter |
      | an unsupported groupBy   | groupBy=tag                                | INVALID_PARAMETER | groupBy   |
      | an empty groupBy         | groupBy=                                   | INVALID_PARAMETER | groupBy   |
      | top of zero              | groupBy=category&top=0                     | INVALID_PARAMETER | top       |
      | top above 20             | groupBy=category&top=21                    | INVALID_PARAMETER | top       |
      | from later than to       | groupBy=month&from=2026-06-01&to=2026-01-01 | INVALID_PARAMETER | to       |
      | a parameter it lacks     | groupBy=month&sort=views                   | UNKNOWN_PARAMETER | sort      |
