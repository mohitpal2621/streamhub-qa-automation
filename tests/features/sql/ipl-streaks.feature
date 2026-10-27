@sql
Feature: SQL scenario 2 - IPL batting streaks
  Find players who scored 30+ runs in at least 3 consecutive matches in the
  2024 season, with the date each streak started. The query and the sample
  data are in sql/ipl_streaks/. Each player in seed.sql is one case.

  Background:
    Given a fresh PostgreSQL database with the "ipl_streaks" tables and sample data

  Scenario: The query returns each streak once, with its start date
    When I run the "ipl_streaks" query
    Then the result has the columns "player_name, streak_start_date"
    And the result is:
      | player_name     | streak_start_date |
      | Aarav Menon     | 2024-03-22        |
      | Neel Chatterjee | 2024-03-22        |
      | Ishaan Bhatt    | 2024-03-24        |
      | Dev Malhotra    | 2024-03-26        |
      | Kian Thomas     | 2024-04-02        |
      | Ishaan Bhatt    | 2024-04-10        |

  Scenario: Each streak is a run of consecutive 30+ scores
    When I run the "ipl_streaks" details query
    Then the result is:
      | player_name     | team | streak_start_date | streak_end_date | matches_in_streak | runs               |
      | Aarav Menon     | CSK  | 2024-03-22        | 2024-03-31      | 3                 | 30, 45, 31         |
      | Neel Chatterjee | RCB  | 2024-03-22        | 2024-04-10      | 3                 | 31, 42, 38         |
      | Ishaan Bhatt    | MI   | 2024-03-24        | 2024-03-31      | 3                 | 35, 40, 50         |
      | Dev Malhotra    | MI   | 2024-03-26        | 2024-04-18      | 5                 | 33, 67, 30, 52, 41 |
      | Kian Thomas     | KKR  | 2024-04-02        | 2024-04-13      | 3                 | 44, 36, 31         |
      | Ishaan Bhatt    | MI   | 2024-04-10        | 2024-04-20      | 3                 | 33, 60, 44         |

  Scenario Outline: The sample data catches a query that <mistake>
    When I run the "ipl_streaks" query with "<correct>" changed to "<mistaken>"
    Then the changed query <effect> the row starting "<row>"

    Examples:
      | mistake                                     | correct                           | mistaken                                     | effect | row                         |
      | orders matches by match_id, not date        | ORDER BY m.match_date, m.match_id | ORDER BY m.match_id                          | misses | Neel Chatterjee, 2024-03-22 |
      | forgets the season filter                   | WHERE m.season = 2024             | WHERE m.season >= 2023                       | adds   | Arjun Pillai, 2023-05-14    |
      | skips matches where the player did not bat  | WHERE m.season = 2024             | WHERE m.season = 2024 AND b.runs IS NOT NULL | adds   | Vihaan Rao, 2024-03-22      |
      | does not count a score of exactly 30        | WHERE runs >= 30                  | WHERE runs > 30                              | misses | Aarav Menon, 2024-03-22     |
      | needs more than three matches               | HAVING COUNT(*) >= 3              | HAVING COUNT(*) > 3                          | misses | Ishaan Bhatt, 2024-03-24    |
