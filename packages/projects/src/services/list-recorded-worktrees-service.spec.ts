import { describe, expect, it } from 'vitest';
import type { RegisteredProject } from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { InMemoryWorktreePresenceStore } from '../../spec/fakes/in-memory-worktree-presence-store.ts';
import { ListRecordedWorktreesService } from './list-recorded-worktrees-service.ts';

const project: RegisteredProject = {
  id: 'project-1',
  name: 'api',
  namedByOwner: false,
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'repository-1',
  available: true,
  position: 1,
};

describe('ListRecordedWorktreesService', () => {
  it('answers every recorded worktree, present or absent, with the repository of its registered project', () => {
    const presence = new InMemoryWorktreePresenceStore();
    presence.save({
      rows: [
        { worktreeId: 'here', projectId: project.id, missingSince: undefined },
        {
          worktreeId: 'away',
          projectId: project.id,
          missingSince: '2026-08-01T00:00:00.000Z',
        },
        {
          worktreeId: 'orphan',
          projectId: 'project-gone',
          missingSince: undefined,
        },
      ],
    });
    expect(
      new ListRecordedWorktreesService(
        presence,
        new InMemoryInventoryStore([project]),
      ).execute(),
    ).toEqual({
      worktrees: [
        { id: 'here', projectId: project.id, repositoryId: 'repository-1' },
        { id: 'away', projectId: project.id, repositoryId: 'repository-1' },
      ],
    });
  });
});
