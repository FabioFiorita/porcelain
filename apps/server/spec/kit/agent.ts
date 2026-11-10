import { Schema } from 'effect';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import type { AgentAction, Session } from './session.ts';
import { seedStressSample } from './stress-sample.ts';
export async function agentActs(
  session: Session,
  action: AgentAction,
): Promise<unknown> {
  if (action.kind === 'seed') return seedStressSample(session, action.variant);
  const inventory = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    (await session.read({ method: 'GET', path: '/api/inventory' })).body,
  );
  const project = inventory.projects.find((entry) =>
    entry.worktrees.some((worktree) => worktree.path === session.repository),
  );
  const worktree = project?.worktrees.find(
    (entry) => entry.path === session.repository,
  );
  if (!project || !worktree)
    throw new Error('Fixture checkout must be registered');
  session.projectId = project.id;
  session.worktreeId = worktree.id;
  return (
    await session.read({
      method: 'POST',
      path: `/api/worktrees/${session.worktreeId}/files`,
      body: action.edit,
    })
  ).body;
}
