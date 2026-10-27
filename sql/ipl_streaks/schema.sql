-- Scenario 2: an IPL-style batting dataset. Names and scores are made up.

CREATE TABLE players (
    player_id   INTEGER     PRIMARY KEY,
    player_name VARCHAR(60) NOT NULL,
    team        VARCHAR(10) NOT NULL
);

CREATE TABLE matches (
    match_id   INTEGER     PRIMARY KEY,
    season     INTEGER     NOT NULL,
    match_date DATE        NOT NULL,
    home_team  VARCHAR(10) NOT NULL,
    away_team  VARCHAR(10) NOT NULL
);

-- One row per player per match they played in. A player left out of the XI
-- has no row; a player who was in the XI but did not bat has runs = NULL.
CREATE TABLE batting_scores (
    match_id  INTEGER NOT NULL REFERENCES matches (match_id),
    player_id INTEGER NOT NULL REFERENCES players (player_id),
    runs      INTEGER CHECK (runs >= 0),
    PRIMARY KEY (match_id, player_id)
);
