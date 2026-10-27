INSERT INTO players (player_id, player_name, team) VALUES
(1, 'Aarav Menon',     'CSK'),
(2, 'Kabir Sethi',     'CSK'),
(3, 'Dev Malhotra',    'MI'),
(4, 'Ishaan Bhatt',    'MI'),
(5, 'Neel Chatterjee', 'RCB'),
(6, 'Vihaan Rao',      'RCB'),
(7, 'Arjun Pillai',    'KKR'),
(8, 'Reyansh Dutta',   'KKR'),
(9, 'Kian Thomas',     'KKR');

INSERT INTO matches (match_id, season, match_date, home_team, away_team) VALUES
-- End of the 2023 season, to check that the query ignores other seasons.
(91,  2023, '2023-05-14', 'KKR', 'CSK'),
(92,  2023, '2023-05-20', 'MI',  'KKR'),
(93,  2023, '2023-05-26', 'KKR', 'RCB'),
-- 2024. Match 108 was rained off on 7 April and replayed on 13 April under the
-- same match_id, so match_id order is not date order for RCB and KKR.
(101, 2024, '2024-03-22', 'CSK', 'RCB'),
(102, 2024, '2024-03-24', 'MI',  'KKR'),
(103, 2024, '2024-03-26', 'RCB', 'MI'),
(104, 2024, '2024-03-28', 'KKR', 'CSK'),
(105, 2024, '2024-03-31', 'CSK', 'MI'),
(106, 2024, '2024-04-02', 'RCB', 'KKR'),
(107, 2024, '2024-04-05', 'MI',  'CSK'),
(108, 2024, '2024-04-13', 'KKR', 'RCB'),
(109, 2024, '2024-04-12', 'CSK', 'KKR'),
(110, 2024, '2024-04-10', 'MI',  'RCB'),
(111, 2024, '2024-04-15', 'RCB', 'CSK'),
(112, 2024, '2024-04-18', 'KKR', 'MI'),
(113, 2024, '2024-04-20', 'MI',  'RCB'),
(114, 2024, '2024-04-22', 'KKR', 'CSK'),
(115, 2024, '2024-04-25', 'RCB', 'KKR'),
(116, 2024, '2024-04-27', 'CSK', 'MI');

INSERT INTO batting_scores (match_id, player_id, runs) VALUES
-- Aarav Menon: exactly three in a row (30, 45, 31) from 22 March, and exactly
-- 30 counts. Reported once, starting 2024-03-22.
(91, 1, 50),
(101, 1, 30), (104, 1, 45), (105, 1, 31), (107, 1, 12),
(109, 1, 8),  (111, 1, 22), (114, 1, 64), (116, 1, 30),

-- Kabir Sethi: three pairs of 30+ scores, each broken up (29 is one short).
-- Never three in a row, so not reported.
(91, 2, 12),
(101, 2, 55), (104, 2, 34), (105, 2, 29), (107, 2, 41),
(109, 2, 38), (111, 2, 7),  (114, 2, 30), (116, 2, 31),

-- Dev Malhotra: five in a row from 26 March. Reported once, not three times.
(92, 3, 31),
(102, 3, 12), (103, 3, 33), (105, 3, 67), (107, 3, 30),
(110, 3, 52), (112, 3, 41), (113, 3, 19), (116, 3, 88),

-- Ishaan Bhatt: two separate streaks in the season, from 24 March and from
-- 10 April. Reported twice.
(92, 4, 0),
(102, 4, 35), (103, 4, 40), (105, 4, 50), (107, 4, 10),
(110, 4, 33), (112, 4, 60), (113, 4, 44), (116, 4, 2),

-- Neel Chatterjee: left out of the XI for match 103, so his own matches go
-- 31, 42, 38 in date order. Reported, starting 2024-03-22. Ordered by match_id
-- instead (101, 106, 108, 110) the run would be broken by the 5 in match 108.
(93, 5, 22),
(101, 5, 31), (106, 5, 42), (110, 5, 38), (108, 5, 5),
(111, 5, 50), (113, 5, 12),

-- Vihaan Rao: played but did not bat in match 106 (runs NULL). That breaks
-- the run, leaving two pairs, so not reported.
(93, 6, 45),
(101, 6, 40), (103, 6, 55), (106, 6, NULL), (110, 6, 36),
(108, 6, 48), (111, 6, 9),  (113, 6, 70),   (115, 6, 3),

-- Arjun Pillai: three in a row at the end of 2023 and two at the start of
-- 2024. Only 2024 counts, so not reported.
(91, 7, 45), (92, 7, 52), (93, 7, 61),
(102, 7, 38), (104, 7, 47), (106, 7, 11), (109, 7, 30),
(108, 7, 30), (112, 7, 29), (114, 7, 51), (115, 7, 0),

-- Reyansh Dutta: no 30+ scores.
(91, 8, 8),
(102, 8, 4),  (104, 8, 18), (106, 8, 27), (109, 8, 22),
(108, 8, 9),  (112, 8, 15), (114, 8, 26), (115, 8, 1),

-- Kian Thomas: 44, 36, 31 across the replayed match, from 2 April. Reported.
(102, 9, 8),  (104, 9, 20), (106, 9, 44), (109, 9, 36),
(108, 9, 31), (112, 9, 15), (114, 9, 33), (115, 9, 47);
