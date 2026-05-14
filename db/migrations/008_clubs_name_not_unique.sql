-- Nama klub tidak perlu unik secara global.
-- Keunikan dijamin di level season_clubs (season_id, club_id) yang sudah ada.
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_name_key;
