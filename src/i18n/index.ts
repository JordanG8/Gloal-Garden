import { en, type Dictionary } from './dictionaries/en';
import { he } from './dictionaries/he';
import type { Locale } from './config';

const DICTS: Record<Locale, Dictionary> = { en, he };

export function getDict(locale: Locale): Dictionary {
  return DICTS[locale] ?? en;
}

/** Tiny interpolation: fill('{n} badges', { n: 3 }) → '3 badges'. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    values[key] !== undefined ? String(values[key]) : `{${key}}`
  );
}

export type { Dictionary };
export * from './config';
