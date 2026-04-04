ALTER TABLE elo_segments ADD COLUMN season_glicko_rating REAL;
ALTER TABLE elo_segments ADD COLUMN season_glicko_rd REAL;
ALTER TABLE elo_segments ADD COLUMN season_glicko_volatility REAL;
ALTER TABLE elo_segments ADD COLUMN season_conservative_rating REAL;
ALTER TABLE elo_segments ADD COLUMN season_attended_weeks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE elo_segments ADD COLUMN season_total_weeks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE elo_segments ADD COLUMN season_attendance_penalty INTEGER NOT NULL DEFAULT 0;
