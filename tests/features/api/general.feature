@api
Feature: Behaviour shared by every endpoint

  Background:
    Given the catalogue API is running

  Scenario: Health check
    When I request "/health"
    Then the response status is 200
    And the response matches the API contract
    And the response field "status" is "ok"

  Scenario Outline: Responses are JSON: <path>
    When I request "<path>"
    Then the response header "content-type" contains "application/json"

    Examples:
      | path                       |
      | /videos                    |
      | /videos/vid_404            |
      | /channels?limit=0          |
      | /stats/views?groupBy=month |

  Scenario Outline: <method> is not allowed on <path>
    When I send a <method> request to "<path>"
    Then the response status is 405
    And the response matches the API contract
    And the response header "allow" contains "GET"
    And the error code is "METHOD_NOT_ALLOWED"

    Examples:
      | method | path           |
      | POST   | /videos        |
      | PUT    | /videos/vid_001 |
      | DELETE | /videos/vid_001 |
      | PATCH  | /channels      |
      | POST   | /stats/views   |

  Scenario: HEAD is answered like GET, without a body
    When I send a HEAD request to "/videos"
    Then the response status is 200
    And the response body is empty

  Scenario: An unknown route returns the standard error body
    When I request "/playlists"
    Then the response status is 404
    And the response body matches the "Error" schema
    And the error code is "NOT_FOUND"

  Scenario: A malformed percent-encoding is a client error, not a crash
    When I request "/videos/%E0%A4%A"
    Then the response status is 400
    And the response body matches the "Error" schema
