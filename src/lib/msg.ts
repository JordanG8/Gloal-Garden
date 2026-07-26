import { fill } from '@/i18n';
import type { Dictionary, Locale } from '@/i18n';

/** Backend note/error keys → localized copy (raw passthrough for legacy strings). */
export function actionMsg(code: string | undefined | null, dict: Dictionary): string | undefined {
  if (!code) return undefined;
  const known = dict.actionMsgs[code as keyof typeof dict.actionMsgs];
  return known ?? code;
}

/**
 * Sentinel scientific name of the placeholder species row that free-typed
 * plants point their FK at (see `plant-actions.ts`). It exists only to give
 * care cadences a home — never show it, or its "Custom Plant" common name,
 * to a human.
 */
const CUSTOM_SPECIES_MARKER = '__custom__';

type SpeciesFields = {
  speciesName: string;
  speciesNameHe: string | null;
  scientificName?: string | null;
  customSpeciesName?: string | null;
};

/** True when the plant carries a free-typed name rather than a real species. */
export function isFreeTypedPlant(s: SpeciesFields): boolean {
  return Boolean(s.customSpeciesName) || s.scientificName === CUSTOM_SPECIES_MARKER;
}

/**
 * What to print on a plant's "species" line, or null when the plant has no
 * real species behind it and the line should be dropped entirely.
 */
export function speciesDisplayName(s: SpeciesFields, locale: Locale): string | null {
  if (s.customSpeciesName) return s.customSpeciesName;
  if (s.scientificName === CUSTOM_SPECIES_MARKER) return null;
  return locale === 'he' && s.speciesNameHe ? s.speciesNameHe : s.speciesName;
}

type PlantSubtitleFields = SpeciesFields & { name: string; plantedByName: string };

/**
 * Secondary line under a plant's name: its species, or who planted it — a
 * free-typed plant with no nickname is *named* after what it is, so repeating
 * that string underneath would be noise.
 */
export function plantSubtitle(plant: PlantSubtitleFields, locale: Locale, dict: Dictionary): string {
  const species = speciesDisplayName(plant, locale);
  if (species && species !== plant.name) return species;
  return fill(dict.plantCard.plantedBy, { name: plant.plantedByName });
}
