/**
 * React/Next abort a prerender the moment the render reaches request-time data,
 * and any IO still in flight is rejected rather than awaited. Those rejections
 * are control flow, not failures: they must propagate so the framework can fall
 * back to the dynamic render. A `try/catch` around a database read that treats
 * them like a dead database is how a live garden ends up prerendered as an
 * empty one — the map loads with zero plants and an error card.
 *
 * The digest is buried under driver wrappers (Drizzle → NeonDbError →
 * sourceError), so walk the chain.
 */
const ABORT_DIGESTS = [
  'HANGING_PROMISE_REJECTION',
  'NEXT_PRERENDER_INTERRUPTED',
  'DYNAMIC_SERVER_USAGE',
  'BAILOUT_TO_CLIENT_SIDE_RENDERING',
];

export function isPrerenderAbort(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 6) return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest === 'string' && ABORT_DIGESTS.some((known) => digest.startsWith(known))) {
    return true;
  }
  const { cause, sourceError } = error as { cause?: unknown; sourceError?: unknown };
  return isPrerenderAbort(cause, depth + 1) || isPrerenderAbort(sourceError, depth + 1);
}

/** Re-raise prerender aborts; return normally for genuine failures to handle. */
export function rethrowIfPrerenderAbort(error: unknown): void {
  if (isPrerenderAbort(error)) throw error;
}
