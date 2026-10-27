-- The same streaks as query.sql, with the length, end date and scores of each.
-- Used as evidence that a five-match streak is one row and that the runs in
-- each streak really are consecutive 30+ scores.

WITH appearances AS (
    SELECT
        b.player_id,
        m.match_date,
        b.runs,
        ROW_NUMBER() OVER (PARTITION BY b.player_id ORDER BY m.match_date, m.match_id) AS appearance_no
    FROM batting_scores AS b
    JOIN matches AS m ON m.match_id = b.match_id
    WHERE m.season = 2024
),
scores_of_30_plus AS (
    SELECT
        player_id,
        match_date,
        runs,
        appearance_no - ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY appearance_no) AS streak_id
    FROM appearances
    WHERE runs >= 30
)
SELECT
    p.player_name,
    p.team,
    MIN(s.match_date)                                  AS streak_start_date,
    MAX(s.match_date)                                  AS streak_end_date,
    COUNT(*)                                           AS matches_in_streak,
    STRING_AGG(s.runs::TEXT, ', ' ORDER BY s.match_date) AS runs
FROM scores_of_30_plus AS s
JOIN players AS p ON p.player_id = s.player_id
GROUP BY p.player_id, p.player_name, p.team, s.streak_id
HAVING COUNT(*) >= 3
ORDER BY streak_start_date, p.player_name;
