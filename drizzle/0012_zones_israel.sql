-- Seeded geographic communities. A zone is this app's subreddit, so these are
-- the founding communities; anywhere else falls into an auto-created grid cell
-- (see src/lib/zones.ts).
--
-- Idempotent on slug, so re-running is a no-op and adding to the list later is
-- just another migration.
--
-- Radii are deliberately generous — a zone that doesn't reach the next street
-- is a community of one.

INSERT INTO zones (slug, name, name_he, kind, lat, lng, radius_m, is_official, description)
VALUES
  ('israel',         'Israel',            'ישראל',        'country',      31.4, 35.0, 250000, 1, 'Everything growing in Israel.'),
  ('haifa-district', 'Haifa District',    'מחוז חיפה',    'region',       32.6, 35.0, 45000,  1, 'From the Carmel down to the Sharon.'),
  ('center-district','Central District',  'מחוז המרכז',   'region',       32.0, 34.9, 45000,  1, 'Tel Aviv and the towns around it.'),
  ('jerusalem-district','Jerusalem District','מחוז ירושלים','region',     31.78, 35.19, 35000, 1, 'The hills and everything on them.'),
  ('north-district', 'Northern District', 'מחוז הצפון',   'region',       32.9, 35.4, 60000,  1, 'The Galilee and the valleys.'),
  ('south-district', 'Southern District', 'מחוז הדרום',   'region',       31.0, 34.8, 90000,  1, 'The Negev, and what grows in it anyway.'),

  ('givat-ada',      'Givat Ada',         'גבעת עדה',     'neighborhood', 32.5185, 35.0047, 3000, 1, 'Where this garden started.'),
  ('binyamina',      'Binyamina',         'בנימינה',      'neighborhood', 32.5150, 34.9490, 3500, 1, 'Vineyards, citrus, and the road between them.'),
  ('zichron-yaakov', 'Zichron Yaakov',    'זכרון יעקב',   'neighborhood', 32.5736, 34.9530, 4000, 1, 'On the ridge, facing the sea.'),
  ('pardes-hanna',   'Pardes Hanna-Karkur','פרדס חנה-כרכור','neighborhood',32.4750, 34.9750, 4500, 1, 'The name means orchard. It still is one.'),
  ('haifa',          'Haifa',             'חיפה',         'city',         32.7940, 34.9896, 12000, 1, 'Terraced gardens all the way down.'),
  ('tel-aviv',       'Tel Aviv-Yafo',     'תל אביב-יפו',  'city',         32.0853, 34.7818, 12000, 1, 'Balconies, courtyards, and the odd surprise ficus.'),
  ('jerusalem',      'Jerusalem',         'ירושלים',      'city',         31.7683, 35.2137, 15000, 1, 'Stone walls and whatever grows out of them.'),
  ('netanya',        'Netanya',           'נתניה',        'city',         32.3215, 34.8532, 9000,  1, 'Sand, sun, and a lot of citrus.'),
  ('hadera',         'Hadera',            'חדרה',         'city',         32.4340, 34.9196, 9000,  1, 'Eucalyptus country turned garden country.')
ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint

-- Wire the hierarchy by slug, so the insert above doesn't depend on ids.
UPDATE zones child SET parent_id = parent.id
FROM zones parent
WHERE parent.slug = 'israel'
  AND child.slug IN ('haifa-district','center-district','jerusalem-district','north-district','south-district')
  AND child.parent_id IS NULL;
--> statement-breakpoint

UPDATE zones child SET parent_id = parent.id
FROM zones parent
WHERE parent.slug = 'haifa-district'
  AND child.slug IN ('givat-ada','binyamina','zichron-yaakov','pardes-hanna','haifa','hadera')
  AND child.parent_id IS NULL;
--> statement-breakpoint

UPDATE zones child SET parent_id = parent.id
FROM zones parent
WHERE parent.slug = 'center-district'
  AND child.slug IN ('tel-aviv','netanya')
  AND child.parent_id IS NULL;
--> statement-breakpoint

UPDATE zones child SET parent_id = parent.id
FROM zones parent
WHERE parent.slug = 'jerusalem-district'
  AND child.slug = 'jerusalem'
  AND child.parent_id IS NULL;
--> statement-breakpoint

-- Materialize the ancestor chain, self included, so a city feed is one array
-- containment check instead of a recursive CTE on every read. Iterating three
-- times covers the depth this hierarchy has (country > region > city).
WITH RECURSIVE chain AS (
  SELECT id, parent_id, ARRAY[id] AS ids FROM zones WHERE parent_id IS NULL
  UNION ALL
  SELECT z.id, z.parent_id, chain.ids || z.id
  FROM zones z JOIN chain ON z.parent_id = chain.id
)
UPDATE zones z SET ancestor_ids = to_jsonb(chain.ids)
FROM chain WHERE z.id = chain.id;
