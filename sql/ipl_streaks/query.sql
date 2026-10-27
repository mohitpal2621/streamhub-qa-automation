-- Players who scored 30+ runs in at least 3 consecutive matches in the 2024
-- season: one row per streak, with the date of the streak's first match.
--
-- "Consecutive" means consecutive matches the player played in, in date order.
-- A match where the player was in the XI but did not bat breaks a streak; a
-- match they were left out of does not.
--
-- This is the gaps-and-islands pattern. appearance_no counts every match a
-- player played; the second ROW_NUMBER counts only the 30+ innings. Inside an
-- unbroken run both go up by one per match, so their difference stays the same
-- and labels the run. Any match in between without a 30+ score changes it.

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
        appearance_no - ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY appearance_no) AS streak_id
    FROM appearances
    WHERE runs >= 30
)
SELECT
    p.player_name,
    MIN(s.match_date) AS streak_start_date
FROM scores_of_30_plus AS s
JOIN players AS p ON p.player_id = s.player_id
GROUP BY p.player_id, p.player_name, s.streak_id
HAVING COUNT(*) >= 3
ORDER BY streak_start_date, p.player_name;
