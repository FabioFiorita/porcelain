import type { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';

export const PRESENCE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

export class CollectAbsentWorktreesService {
  private readonly presence: Pick<WorktreePresenceStore, 'expired' | 'collect'>;
  private readonly now: () => number;

  constructor(
    presence: Pick<WorktreePresenceStore, 'expired' | 'collect'>,
    now: () => number = Date.now,
  ) {
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
