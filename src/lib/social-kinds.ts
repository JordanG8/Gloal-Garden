/**
 * Shared constants for the community feed. Separate from social-actions.ts
 * because a `'use server'` module may only export async functions.
 */

/**
 * Post kinds are shaped to this domain rather than being generic. The one that
 * matters most here is `harvest_share`: a street of lemon trees produces far
 * more fruit than any household can use, and giving the surplus away is the
 * obvious thing a neighbourhood garden app should make easy.
 */
export const POST_KINDS = [
  'discussion',
  'question',
  'photo',
  'harvest_share',
  'trade',
  'alert',
  'event',
] as const;
export type PostKind = (typeof POST_KINDS)[number];

export function isPostKind(value: string): value is PostKind {
  return (POST_KINDS as readonly string[]).includes(value);
}

export const MAX_POST_TITLE = 140;
export const MAX_POST_BODY = 8000;
export const MAX_COMMENT_BODY = 4000;

export const FEED_PAGE_SIZE = 20;
export type FeedSort = 'hot' | 'new' | 'top';
export const FEED_SORTS: FeedSort[] = ['hot', 'new', 'top'];

export function isFeedSort(value: string | null): value is FeedSort {
  return FEED_SORTS.includes(value as FeedSort);
}

/** Reasons offered when flagging content, mirroring the plant-report tags. */
export const REPORT_REASONS = ['spam', 'wrong_place', 'rude', 'unsafe', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
