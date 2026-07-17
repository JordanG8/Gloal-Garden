import type { Dictionary, Locale } from '@/i18n';

/** Backend note/error keys → localized copy (raw passthrough for legacy strings). */
export function actionMsg(code: string | undefined | null, dict: Dictionary): string | undefined {
  if (!code) return undefined;
  const known = dict.actionMsgs[code as keyof typeof dict.actionMsgs];
  return known ?? code;
}

export function speciesDisplayName(
  s: { speciesName: string; speciesNameHe: string | null },
  locale: Locale
): string {
  return locale === 'he' && s.speciesNameHe ? s.speciesNameHe : s.speciesName;
}
