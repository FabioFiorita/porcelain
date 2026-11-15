import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { describe, expect, it } from 'vitest';
import type { RegisterProjectResponse } from '@porcelain/contracts/projects';
import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import { openProject } from './open-project.ts';

const create = clientFixtures();
const projectId = '00000000-0000-4000-8000-000000000001';
const worktreeId = '00000000000000000000000000000002';

function setup(project: RegisterProjectResponse) {
  const requests: unknown[] = [];
  const subject = create(async (path, init) => {
    if (path === '/api/projects') {
      requests.push(await new Response(init?.body).json());
      return Response.json(project);
    }
    return Response.json({
      environmentId: 'environment',
      environment: { name: 'Computer', custom: true },
      projects: [project],
    });
  });
  const completed: string[] = [];
  const recovered: unknown[] = [];
  const selected: unknown[] = [];
  const selectionWhenClosed: boolean[] = [];
  const command = openProject(subject.connection);
  const run = async (reconnectProjectId?: string) => {
    subject.registry.set(command, {
      path: ' /repo ',
      remote: 'remote-computer',
      ...(reconnectProjectId ? { reconnectProjectId } : {}),
      complete: () => {
        selectionWhenClosed.push(selected.length > 0);
        completed.push('closed');
      },
      recover: (project, path) => {
        recovered.push({ project, path });
      },
      select: (target) =>
        Effect.sync(() => {
          selected.push(target);
        }),
    });
    await Effect.runPromise(
      AtomRegistry.getResult(subject.registry, command, {
        suspendOnWaiting: true,
      }),
    );
  };
  return { run, requests, completed, recovered, selected, selectionWhenClosed };
}

describe('opening a replacement repository', () => {
  it('offers owner recovery without closing or selecting an unavailable worktree', async () => {
    const project: RegisterProjectResponse = {
      id: projectId,
      name: 'Original',
      available: false,
      unavailableReason: 'moved',
      worktrees: [],
    };
    const subject = setup(project);
    await subject.run();
    expect(subject.requests).toEqual([{ path: '/repo' }]);
    expect(subject.recovered).toEqual([{ project, path: '/repo' }]);
    expect(subject.completed).toEqual([]);
    expect(subject.selected).toEqual([]);
  });

  it('sends explicit consent for the original project and opens its replacement worktree on the same computer', async () => {
    const subject = setup({
      id: projectId,
      name: 'Original',
      available: true,
      worktrees: [
        {
          id: worktreeId,
          path: '/repo',
          main: true,
          branch: 'main',
          available: true,
        },
      ],
    });
    await subject.run(projectId);
    expect(subject.requests).toEqual([
      { path: '/repo', reconnectProjectId: projectId },
    ]);
    expect(subject.recovered).toEqual([]);
    expect(subject.completed).toEqual(['closed']);
    expect(subject.selectionWhenClosed).toEqual([true]);
    expect(subject.selected).toEqual([
      { remote: 'remote-computer', projectId, worktreeId },
    ]);
  });
});
