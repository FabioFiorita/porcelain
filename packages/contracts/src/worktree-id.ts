import { z } from 'zod';

/**
 * A worktree id is derived, not stored: the first sixteen bytes of a SHA-256
 * over the project and the filesystem identity of the worktree's Git
 * directory, as lowercase hex.
 *
 * It is deliberately not a UUID. Checking the shape here means a stored id
 * from before worktrees were derived cannot arrive at a route looking like a
 * live one.
 */
export const worktreeIdSchema = z.string().regex(/^[0-9a-f]{32}$/);
