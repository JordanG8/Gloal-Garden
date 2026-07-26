-- Backfill `water_due_at` for plants that predate the column.
--
-- Due-ness is still derived at read time, so the map and plant pages were
-- already correct without this. But the daily care sweep finds thirsty plants
-- through the indexed column, so every plant that existed before this branch
-- would have been invisible to reminders until someone happened to water it
-- once. That's precisely the plant most likely to need reminding about.
--
-- Mirrors wateringIntervalDays() in src/lib/care-schedule.ts: plant override,
-- then species seasonal, then the legacy single interval, then a default.
-- Northern-hemisphere Mediterranean dry season is April through October.
UPDATE plants p
SET water_due_at = COALESCE(p.last_watered_at, p.planted_at) + (interval '1 day' * res.days)
FROM (
  SELECT
    pl.id,
    CASE
      WHEN extract(month FROM now()) BETWEEN 4 AND 10
        THEN COALESCE(pl.water_interval_summer_days, s.water_interval_summer_days,
                      s.watering_frequency_days, 7)
      ELSE COALESCE(pl.water_interval_winter_days, s.water_interval_winter_days,
                    s.watering_frequency_days, 21)
    END AS days
  FROM plants pl
  JOIN species s ON s.id = pl.species_id
) AS res
WHERE p.id = res.id
  AND p.water_due_at IS NULL
  AND p.care_mode = 'scheduled'
  AND p.status <> 'removed'
  -- A resolved interval of 0 means "the rain does it" — never due, leave null.
  AND res.days > 0;
