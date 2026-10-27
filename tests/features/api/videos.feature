@api
Feature: Videos endpoint
  GET /videos lists the 30 videos in the catalogue with filtering, search,
  sorting and paging. GET /videos/{videoId} returns one video with its channel.
  Expected counts and ids were worked out by hand from api/data/videos.json.

  Background:
    Given the catalogue API is running

  Scenario: Default listing returns the newest videos first, ten per page
    When I request "/videos"
    Then the response status is 200
    And the response matches the API contract
    And the page contains 10 items
    And the pagination shows page 1 of 3 with 30 items in total
    And the items are sorted by "publishedAt" in descending order
    And the first item is "vid_020"

  Scenario Outline: Filter by category: <category>
    When I request "/videos?category=<category>&limit=50"
    Then the response status is 200
    And the response matches the API contract
    And there are <total> matching items
    And every item has "category" set to one of "<category>"

    Examples:
      | category      | total |
      | music         | 5     |
      | technology    | 3     |
      | entertainment | 1     |
      | music,sports  | 10    |

  Scenario Outline: Filter by live flag: <live>
    When I request "/videos?live=<live>&limit=50"
    Then the response status is 200
    And the response matches the API contract
    And there are <total> matching items
    And every item has "live" set to one of "<live>"

    Examples:
      | live  | total |
      | true  | 6     |
      | false | 24    |

  Scenario: Filter by channel
    When I request "/videos?channelId=ch_003&limit=50"
    Then the response status is 200
    And the response matches the API contract
    And there are 6 matching items
    And every item has "channelId" set to one of "ch_003"

  Scenario Outline: Filter by duration: <query>
    When I request "/videos?<query>&limit=50"
    Then the response status is 200
    And the response matches the API contract
    And there are <total> matching items
    And every item has "durationSeconds" between <min> and <max>

    Examples:
      | query                          | min  | max   | total |
      | minDuration=3600               | 3600 | 99999 | 6     |
      | maxDuration=600                | 0    | 600   | 4     |
      | minDuration=900&maxDuration=1500 | 900  | 1500  | 10    |
      | minDuration=905&maxDuration=905  | 905  | 905   | 2     |

  Scenario Outline: Filter by publish date: <query>
    When I request "/videos?<query>&sort=publishedAt&limit=50"
    Then the response status is 200
    And the response matches the API contract
    And the item ids are "<ids>"

    Examples:
      | query                        | ids                                              |
      | from=2026-03-01&to=2026-03-31 | vid_003, vid_012, vid_019, vid_028, vid_007     |
      | from=2026-03-05&to=2026-03-05 | vid_003                                         |
      | from=2026-09-01              | vid_017, vid_025, vid_020                        |
      | to=2025-12-31                | vid_016, vid_018, vid_006, vid_009, vid_026, vid_023 |

  Scenario Outline: Search titles and tags for "<term>"
    When I request "/videos?q=<term>&sort=title"
    Then the response status is 200
    And the response matches the API contract
    And the item ids are "<ids>"
    And every item mentions "<match>" in its title or tags

    Examples:
      | term          | match      | ids              |
      | highlights    | highlights | vid_024, vid_001 |
      | TESTING       | testing    | vid_015, vid_011 |
      | %20%20sql%20%20 | sql      | vid_013          |
      | top-10        | top-10     | vid_023, vid_004 |

  Scenario: A search with no matches returns an empty page, not an error
    When I request "/videos?q=cooking"
    Then the response status is 200
    And the response matches the API contract
    And the page contains 0 items
    And the pagination shows page 1 of 0 with 0 items in total

  Scenario Outline: Sort by <sort>
    When I request "/videos?sort=<sort>&limit=50"
    Then the response status is 200
    And the response matches the API contract
    And the items are sorted by "<field>" in <direction> order
    And the first item is "<first>"

    Examples:
      | sort             | field           | direction  | first   |
      | publishedAt      | publishedAt     | ascending  | vid_016 |
      | -publishedAt     | publishedAt     | descending | vid_020 |
      | views            | views           | ascending  | vid_015 |
      | -views           | views           | descending | vid_018 |
      | durationSeconds  | durationSeconds | ascending  | vid_006 |
      | -durationSeconds | durationSeconds | descending | vid_018 |
      | title            | title           | ascending  | vid_006 |
      | -title           | title           | descending | vid_020 |

  Scenario Outline: Page <page> with <limit> items per page
    When I request "/videos?sort=views&page=<page>&limit=<limit>"
    Then the response status is 200
    And the response matches the API contract
    And the page contains <count> items
    And the pagination shows page <page> of <pages> with 30 items in total

    Examples:
      | page  | limit | count | pages |
      | 1     | 1     | 1     | 30    |
      | 2     | 7     | 7     | 5     |
      | 5     | 7     | 2     | 5     |
      | 1     | 50    | 30    | 1     |
      | 6     | 7     | 0     | 5     |
      | 10000 | 50    | 0     | 1     |

  Scenario: Paging through a sorted list returns every video exactly once
    When I collect every page of "/videos?sort=title&limit=7"
    Then I have 30 different videos in title order

  Scenario: Filters, sorting and paging combine
    When I request "/videos?category=sports,gaming&live=false&minDuration=900&sort=-views&limit=3"
    Then the response status is 200
    And the response matches the API contract
    And the pagination shows page 1 of 2 with 6 items in total
    And the item ids are "vid_024, vid_003, vid_005"

  Scenario: Get one video with its channel
    When I request "/videos/vid_011"
    Then the response status is 200
    And the response matches the API contract
    And the response field "title" is "Playwright vs Cypress in 2026"
    And the response field "channel.name" is "Byte Sized Tech"
    And the response field "channel.verified" is "true"

  Scenario Outline: Looking up a video fails for <case>
    When I request "<path>"
    Then the response status is <status>
    And the response matches the API contract
    And the error code is "<code>"

    Examples:
      | case                         | path                           | status | code              |
      | an id that does not exist    | /videos/vid_999                | 404    | NOT_FOUND         |
      | an id in the wrong format    | /videos/12                     | 400    | INVALID_PARAMETER |
      | an id with SQL in it         | /videos/vid_001'%20OR%20'1'='1 | 400    | INVALID_PARAMETER |
      | a query parameter            | /videos/vid_001?expand=channel | 400    | UNKNOWN_PARAMETER |
