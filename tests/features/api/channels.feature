@api
Feature: Channels endpoint
  GET /channels lists the six channels with filters, search, sorting and paging.

  Background:
    Given the catalogue API is running

  Scenario: Default listing is sorted by name
    When I request "/channels"
    Then the response status is 200
    And the response matches the API contract
    And the pagination shows page 1 of 1 with 6 items in total
    And the items are sorted by "name" in ascending order

  Scenario Outline: Filter channels: <filter>
    When I request "/channels?<query>"
    Then the response status is 200
    And the response matches the API contract
    And the item ids are "<ids>"

    Examples:
      | filter                    | query                                      | ids            |
      | by country                | country=IN                                 | ch_003, ch_006 |
      | unverified only           | verified=false                             | ch_005, ch_004 |
      | at least 1M subscribers   | minSubscribers=1000000                     | ch_003, ch_001 |
      | search by name            | q=beats                                    | ch_002         |
      | search by handle          | q=@wild                                    | ch_006         |
      | country with no channels  | country=FR                                 |                |
      | combined, sorted          | country=GB&verified=true&sort=-subscribers | ch_001, ch_002 |

  Scenario Outline: Sort channels by <sort>
    When I request "/channels?sort=<sort>"
    Then the response status is 200
    And the items are sorted by "<field>" in <direction> order
    And the item ids are "<ids>"

    Examples:
      | sort         | field       | direction  | ids                                            |
      | name         | name        | ascending  | ch_003, ch_005, ch_002, ch_001, ch_004, ch_006 |
      | -name        | name        | descending | ch_006, ch_004, ch_001, ch_002, ch_005, ch_003 |
      | subscribers  | subscribers | ascending  | ch_005, ch_004, ch_006, ch_002, ch_001, ch_003 |
      | -subscribers | subscribers | descending | ch_003, ch_001, ch_002, ch_006, ch_004, ch_005 |
      | createdAt    | createdAt   | ascending  | ch_003, ch_001, ch_006, ch_002, ch_004, ch_005 |
      | -createdAt   | createdAt   | descending | ch_005, ch_004, ch_002, ch_006, ch_001, ch_003 |

  Scenario: The second page holds the remaining channels
    When I request "/channels?limit=4&page=2"
    Then the response status is 200
    And the response matches the API contract
    And the page contains 2 items
    And the pagination shows page 2 of 2 with 6 items in total

  Scenario: Each channel's video count agrees with the videos endpoint
    When I request "/channels"
    Then each channel's "videoCount" equals the number of videos the videos endpoint returns for it

  Scenario Outline: Reject <case>
    When I request "/channels?<query>"
    Then the response status is 400
    And the response matches the API contract
    And the error code is "<code>"
    And the error points at the "<parameter>" parameter

    Examples:
      | case                         | query             | code              | parameter      |
      | a lower-case country code    | country=gb        | INVALID_PARAMETER | country        |
      | a three-letter country code  | country=GBR       | INVALID_PARAMETER | country        |
      | a verified flag of "1"       | verified=1        | INVALID_PARAMETER | verified       |
      | negative subscribers         | minSubscribers=-1 | INVALID_PARAMETER | minSubscribers |
      | a sort field videos have     | sort=views        | INVALID_PARAMETER | sort           |
      | a limit of 500               | limit=500         | INVALID_PARAMETER | limit          |
      | a filter that videos have    | category=music    | UNKNOWN_PARAMETER | category       |
