import type { WorktreePresenceStore } from '../repositories/interfaces/worktree-presence-store.ts';

export const PRESENCE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

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
