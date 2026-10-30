/** How long the app may stay in the background before it asks for the fingerprint again. */
export const RELOCK_AFTER_MS = 60_000;

/**
 * Whether returning to the app after `backgroundedAt` requires unlocking. A clock that moved
 * backwards (manual change) also locks, so changing the time cannot extend the grace period.
 */
export function shouldRelock(backgroundedAt: number, now: number, timeoutMs = RELOCK_AFTER_MS): boolean {
  const elapsed = now - backgroundedAt;
  return elapsed < 0 || elapsed >= timeoutMs;
}
