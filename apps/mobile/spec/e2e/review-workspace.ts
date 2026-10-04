import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { readChangesResponseSchema } from '@porcelain/contracts/changes';
import { sampleReview, worktreePath } from '@porcelain/server/kit/requests';
import { eventually } from '@porcelain/server/kit/reads';
import type { Environment } from '../kit/environment.ts';

const execute = promisify(execFile);

export async function prepareReview(environment: Environment) {
  const ids = await environment.server.sampleIds();
  const seed = environment.server.session(environment.recorder, ids);
  await eventually(seed, { method: 'GET', path: '/api/inventory' }, (body) =>
    readInventoryResponseSchema
      .parse(body)
      .projects.some((project) =>
        project.worktrees.some((worktree) =>
          worktree.branch?.endsWith('/mobile-review'),
        ),
      ),
  );
  const inventory = readInventoryResponseSchema.parse(
    (
      await environment.server.read(environment.recorder, {
        method: 'GET',
        path: '/api/inventory',
      })
    ).body,
  );
  const project = inventory.projects.find(
    (item) => item.name === environment.workspace?.projectName,
  );
  const worktree = project?.worktrees.find((item) =>
    item.branch?.endsWith('/mobile-review'),
  );
  if (!project || !worktree)
    throw new Error('Expected the disposable review worktree');
  const session = environment.server.session(environment.recorder, {
    projectId: project.id,
    worktreeId: worktree.id,
  });
  const path = session.fixture.readme.path;
  const branchPath = 'review-branch.txt';
  await writeFile(join(worktree.path, branchPath), 'Native branch review.\n');
  await execute('git', ['-C', worktree.path, 'add', '--', branchPath]);
  await execute('git', [
    '-C',
    worktree.path,
    '-c',
    'core.hooksPath=/dev/null',
    '-c',
    'user.name=Porcelain Verification',
    '-c',
    'user.email=verify@example.invalid',
    'commit',
    '-m',
    'Add branch review fixture',
  ]);
  await writeFile(join(worktree.path, path), session.fixture.readme.changed);
  await session.read({
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(session, 0, randomUUID(), randomUUID(), {
      title: 'Review the readme',
    }),
  });
  const changes = readChangesResponseSchema.parse(
    (
      await session.read({
        method: 'GET',
        path: worktreePath(session, '/changes'),
      })
    ).body,
  );
  const file = changes.changes.find((item) => item.path === path);
  if (!file?.fingerprint)
    throw new Error('Expected a fingerprint for the changed readme');
  await session.read({
    method: 'PUT',
    path: worktreePath(session, '/reviewed'),
    body: { path, fingerprint: file.fingerprint, reviewed: true },
  });
  await session.read({
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: {
      anchor: { kind: 'file', filePath: path },
      body: 'Please explain the readme change.',
    },
  });
  return { worktreeId: worktree.id, path, branchPath };
}
