import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { join } from 'node:path';
import type { Environment } from '../kit/environment.ts';

export async function prepareHistory(environment: Environment) {
  const inventory = readInventoryResponseSchema.parse(
    (
      await environment.server.read(environment.recorder, {
        method: 'GET',
        path: '/api/inventory',
      })
    ).body,
  );
  const project = inventory.projects[0];
  const worktree = project?.worktrees.find((entry) => entry.main);
  if (!project || !worktree || !worktree.branch)
    throw new Error('Expected the fixture main worktree');
  const session = environment.server.session(environment.recorder, {
    projectId: project.id,
    worktreeId: worktree.id,
  });
  const root = (
    await session.git('rev-list', '--max-parents=0', 'HEAD')
  ).trim();
  const originalWorktree = 'history-original';
  await session.git(
    'worktree',
    'add',
    '-b',
    originalWorktree,
    join(environment.server.projectHome, originalWorktree),
    root,
  );
  await session.writeFile(session.fixture.readme.path, 'History readme\n');
  await session.git(
    'commit',
    '-am',
    'Update history readme',
    '-m',
    'History commit body',
  );
  const update = (await session.git('rev-parse', 'HEAD')).trim();
  await session.git('mv', session.fixture.readme.path, 'GUIDE.md');
  await session.git('commit', '-m', 'Rename history readme');
  const rename = (await session.git('rev-parse', 'HEAD')).trim();
  return {
    projectName: project.name,
    worktreeLabel: worktree.branch.replace(/^refs\/heads\//, ''),
    readme: session.fixture.readme.path,
    root,
    originalWorktree,
    update,
    rename,
  };
}
