import type { AgentAction, Session } from './session.ts';
import { seedStressSample } from './stress-sample.ts';
export async function agentActs(
  session: Session,
  action: AgentAction,
): Promise<unknown> {
  if (action.kind === 'seed') return seedStressSample(session, action.variant);
  return (
    await session.read({
      method: 'POST',
      path: `/api/worktrees/${session.worktreeId}/files`,
      body: action.edit,
    })
  ).body;
}
