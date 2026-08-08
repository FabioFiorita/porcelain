/**
 * How often a live read re-asks the daemon.
 *
 * The working tree changes under the agent while you read it, and the daemon only pushes a
 * `working-tree` event to clients that explicitly watch a file — so anything showing live
 * repo state polls. Committed history never changes under the reader and must not.
 *
 * Lives on the daemon seam rather than in one feature because Changes and the diff surfaces
 * have to agree: React Query uses the shortest interval among a key's observers, so two
 * surfaces sharing a cache entry with different rates would silently take the faster one.
 */
export const LIVE_POLL_MS = 3_000

/**
 * How often the tab-bar's changed-file badge re-asks — the same `gitFlow` entry the Changes
 * list reads, at a rate a badge deserves.
 *
 * Shared here rather than written into the badge hook because it lands on a cache key that
 * `LIVE_POLL_MS` observers also hold: React Query takes the shortest interval among a key's
 * observers, so this rate is what runs while the Changes tab is off screen and the live rate is
 * what runs when it is open. Two numbers on one key only behave if they are read together.
 */
export const BADGE_POLL_MS = 15_000
