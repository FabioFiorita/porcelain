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
