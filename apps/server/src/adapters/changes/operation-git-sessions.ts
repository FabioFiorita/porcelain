import { RequestGitSession } from '@porcelain/git/actions';
import type { GitSession } from '@porcelain/git/inspection';

export class OperationGitSessions {
  private readonly sessions = new WeakMap<AbortSignal, GitSession>();

  for(signal?: AbortSignal): GitSession {
    if (signal === undefined) return new RequestGitSession();
    const existing = this.sessions.get(signal);
    if (existing) return existing;
    const created = new RequestGitSession();
    this.sessions.set(signal, created);
    return created;
  }
}
