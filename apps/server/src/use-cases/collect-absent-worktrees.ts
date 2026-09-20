import type { WorktreePresenceStore } from '../repositories/interfaces/worktree-presence-store.ts';

/** Thirty days from the first trustworthy absence. */
export const PRESENCE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Delete review data for worktrees Git has not listed for thirty days.
 *
 * The clock is not "how long since we saw it" but "how long since a listing
 * that worked said it was gone". A project whose disk is unplugged never
 * observes an absence, so nothing of its is ever collected — which is the case
 * the grace period exists for.
 */
export class CollectAbsentWorktrees {
  private readonly presence: WorktreePresenceStore;
  private readonly now: () => number;

  constructor(presence: WorktreePresenceStore, now: () => number = Date.now) {
    this.presence = presence;
    this.now = now;
  }

  execute(): { collected: string[] } {
    const expired = this.presence.expired(
      new Date(this.now() - PRESENCE_GRACE_MS).toISOString(),
    );
    this.presence.collect(expired);
    return { collected: expired };
  }
}
