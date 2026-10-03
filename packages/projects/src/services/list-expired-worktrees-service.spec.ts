import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import type {
  RegisteredProject,
  WorktreePresence,
} from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { InMemoryWorktreePresenceStore } from '../../spec/fakes/in-memory-worktree-presence-store.ts';
import { ListExpiredWorktreesService } from './list-expired-worktrees-service.ts';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function project(id: string, repositoryIdentity: string): RegisteredProject {
  return {
    id,
    name: id,
    namedByOwner: false,
    commonDirectory: `/srv/${id}/.git`,
    repositoryIdentity,
    available: true,
    position: 1,
  };
}

function service(
  rows: WorktreePresence[],
  projects: RegisteredProject[] = [project('project-1', 'repository-1')],
) {
  const presence = new InMemoryWorktreePresenceStore();
  presence.save({ rows });
  return new ListExpiredWorktreesService(
    presence,
    new InMemoryInventoryStore(projects),
    new FixedClock('2026-08-31T00:00:00.001Z'),
    { graceMs: THIRTY_DAYS_MS },
  );
}

describe('ListExpiredWorktreesService', () => {
  it('answers each worktree absent past the grace period with the repository of its project', () => {
    expect(
      service([
        {
          worktreeId: 'gone',
          projectId: 'project-1',
          missingSince: '2026-08-01T00:00:00.000Z',
        },
      ]).execute(),
    ).toEqual({
      worktrees: [
        { id: 'gone', projectId: 'project-1', repositoryId: 'repository-1' },
      ],
    });
  });

  it('leaves out present worktrees and those still within the grace period', () => {
    expect(
      service([
        { worktreeId: 'here', projectId: 'project-1', missingSince: undefined },
        {
          worktreeId: 'recent',
          projectId: 'project-1',
          missingSince: '2026-08-30T00:00:00.000Z',
        },
      ]).execute(),
    ).toEqual({ worktrees: [] });
  });

  it('leaves out a worktree whose project is no longer registered', () => {
    expect(
      service(
        [
          {
            worktreeId: 'orphan',
            projectId: 'project-gone',
            missingSince: '2026-08-01T00:00:00.000Z',
          },
        ],
        [],
      ).execute(),
    ).toEqual({ worktrees: [] });
  });
});
