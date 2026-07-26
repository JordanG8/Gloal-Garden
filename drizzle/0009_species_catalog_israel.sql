-- The species catalogue, weighted towards what actually grows in Israeli
-- gardens and bulges over the walls into the street: citrus, then the rest of
-- the Mediterranean fruit trees.
--
-- This lives in a migration rather than scripts/seed.ts because the seed only
-- ever runs against an empty database (see scripts/prepare-db.ts) — anything
-- the app needs at runtime has to arrive here. Idempotent in both directions:
-- rows missing by scientific name are inserted, rows already present get their
-- perennial/seasonal fields filled in. Safe to re-run.
--
-- Watering intervals are days between waterings for an *established* plant.
-- A winter interval of 0 means "the rain does it" — which for most of these,
-- in this climate, it does.
--
-- Harvest months are inclusive and may wrap the year: lemons run 11 -> 3.

CREATE TEMP TABLE species_catalog (
  common_name text,
  common_name_he text,
  scientific_name text,
  category text,
  emoji text,
  is_perennial integer,
  harvest_month_start integer,
  harvest_month_end integer,
  years_to_first_harvest integer,
  water_summer integer,
  water_winter integer,
  sun_requirements text
) ON COMMIT DROP;
--> statement-breakpoint

INSERT INTO species_catalog VALUES
  -- Citrus. The prediction this catalogue is built around.
  ('Lemon',            'לימון',        'Citrus limon',            'fruit', '🍋', 1, 11, 3,  3, 10, 0,  'Full sun'),
  ('Shamouti Orange',  'תפוז שמוטי',   'Citrus sinensis',         'fruit', '🍊', 1, 12, 4,  3, 10, 0,  'Full sun'),
  ('Clementine',       'קלמנטינה',     'Citrus clementina',       'fruit', '🍊', 1, 11, 1,  3, 10, 0,  'Full sun'),
  ('Mandarin',         'מנדרינה',      'Citrus reticulata',       'fruit', '🍊', 1, 11, 2,  3, 10, 0,  'Full sun'),
  ('Pomelo',           'פומלה',        'Citrus maxima',           'fruit', '🍈', 1, 12, 2,  4, 10, 0,  'Full sun'),
  ('Grapefruit',       'אשכולית',      'Citrus paradisi',         'fruit', '🍊', 1, 12, 4,  4, 10, 0,  'Full sun'),
  ('Kumquat',          'קומקוואט',     'Citrus japonica',         'fruit', '🍊', 1, 12, 3,  3, 10, 0,  'Full sun'),
  ('Etrog',            'אתרוג',        'Citrus medica',           'fruit', '🍋', 1,  9, 10, 3, 7,  0,  'Full sun'),
  ('Lime',             'ליים',         'Citrus aurantiifolia',    'fruit', '🍋', 1,  8, 11, 3, 10, 0,  'Full sun'),
  ('Bitter Orange',    'חושחש',        'Citrus aurantium',        'fruit', '🍊', 1, 12, 3,  4, 14, 0,  'Full sun'),

  -- The rest of the Mediterranean orchard.
  ('Olive',            'זית',          'Olea europaea',           'tree',  '🫒', 1, 10, 12, 5, 21, 0,  'Full sun'),
  ('Pomegranate',      'רימון',        'Punica granatum',         'fruit', '🍎', 1,  9, 11, 3, 14, 0,  'Full sun'),
  ('Loquat',           'שסק',          'Eriobotrya japonica',     'fruit', '🍑', 1,  3, 5,  4, 14, 0,  'Full sun'),
  ('Guava',            'גויאבה',       'Psidium guajava',         'fruit', '🍐', 1,  9, 12, 3, 7,  0,  'Full sun'),
  ('Carob',            'חרוב',         'Ceratonia siliqua',       'tree',  '🌳', 1,  8, 10, 6, 30, 0,  'Full sun'),
  ('Date Palm',        'תמר',          'Phoenix dactylifera',     'tree',  '🌴', 1,  8, 10, 6, 14, 0,  'Full sun'),
  ('Avocado',          'אבוקדו',       'Persea americana',        'fruit', '🥑', 1, 11, 4,  4, 5,  21, 'Full sun'),
  ('Mango',            'מנגו',         'Mangifera indica',        'fruit', '🥭', 1,  7, 9,  4, 7,  0,  'Full sun'),
  ('Prickly Pear',     'צבר',          'Opuntia ficus-indica',    'fruit', '🌵', 1,  7, 9,  3, 30, 0,  'Full sun'),
  ('White Mulberry',   'תות עץ',       'Morus alba',              'tree',  '🌳', 1,  5, 6,  3, 14, 0,  'Full sun'),
  ('Almond',           'שקד',          'Prunus dulcis',           'tree',  '🌰', 1,  8, 9,  3, 21, 0,  'Full sun'),
  ('Grapevine',        'גפן',          'Vitis vinifera',          'fruit', '🍇', 1,  7, 9,  3, 14, 0,  'Full sun'),
  ('Fig',              'תאנה',         'Ficus carica',            'tree',  '🌳', 1,  6, 9,  3, 10, 0,  'Full sun'),
  ('Apple',            'תפוח',         'Malus domestica',         'tree',  '🍎', 1,  8, 10, 4, 10, 0,  'Full sun'),

  -- Perennial herbs: harvestable most of the year once established.
  ('Rosemary',         'רוזמרין',      'Salvia rosmarinus',       'herb',  '🌿', 1,  1, 12, 1, 21, 0,  'Full sun'),
  ('Sage',             'מרווה',        'Salvia officinalis',      'herb',  '🌿', 1,  1, 12, 1, 21, 0,  'Full sun'),
  ('Mint',             'נענע',         'Mentha spicata',          'herb',  '🌿', 1,  3, 11, 1, 3,  10, 'Partial shade'),
  ('Lemon Verbena',    'לואיזה',       'Aloysia citrodora',       'herb',  '🌿', 1,  4, 10, 1, 5,  14, 'Full sun'),
  ('Za''atar',         'זעתר',         'Origanum syriacum',       'herb',  '🌿', 1,  3, 11, 1, 14, 0,  'Full sun'),
  ('Bay Laurel',       'עלי דפנה',     'Laurus nobilis',          'tree',  '🌿', 1,  1, 12, 2, 14, 0,  'Partial shade');
--> statement-breakpoint

-- Insert only what's missing, matched on scientific name. `watering_frequency_days`
-- is NOT NULL on the table and is still read by code paths that predate the
-- seasonal columns, so it gets the summer interval as its single value.
INSERT INTO species (
  common_name, common_name_he, scientific_name, category, emoji,
  is_perennial, harvest_month_start, harvest_month_end, years_to_first_harvest,
  water_interval_summer_days, water_interval_winter_days,
  watering_frequency_days, sun_requirements
)
SELECT
  c.common_name, c.common_name_he, c.scientific_name, c.category, c.emoji,
  c.is_perennial, c.harvest_month_start, c.harvest_month_end, c.years_to_first_harvest,
  c.water_summer, c.water_winter,
  GREATEST(c.water_summer, 1), c.sun_requirements
FROM species_catalog c
WHERE NOT EXISTS (
  SELECT 1 FROM species s WHERE s.scientific_name = c.scientific_name
);
--> statement-breakpoint

-- Backfill the perennial/seasonal fields on rows that already existed (the demo
-- seed ships a Fig, a Lemon Tree and an Apple Tree). Names and categories are
-- left alone — someone may have edited them.
UPDATE species s SET
  is_perennial               = c.is_perennial,
  harvest_month_start        = c.harvest_month_start,
  harvest_month_end          = c.harvest_month_end,
  years_to_first_harvest     = c.years_to_first_harvest,
  water_interval_summer_days = COALESCE(s.water_interval_summer_days, c.water_summer),
  water_interval_winter_days = COALESCE(s.water_interval_winter_days, c.water_winter),
  common_name_he             = COALESCE(s.common_name_he, c.common_name_he)
FROM species_catalog c
WHERE s.scientific_name = c.scientific_name;
--> statement-breakpoint

-- Every plant currently in the database points at the '__custom__' sentinel
-- species, which means it inherited a flat 7-day cadence. Give that row an
-- honest seasonal default so existing pins stop claiming to be thirsty in
-- January. Individual plants can still override it.
UPDATE species
SET water_interval_summer_days = COALESCE(water_interval_summer_days, 7),
    water_interval_winter_days = COALESCE(water_interval_winter_days, 21)
WHERE scientific_name = '__custom__';
