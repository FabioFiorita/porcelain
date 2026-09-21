import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { createMockStore } from '../../api/inventory/mock';
import { createMockApi } from '../../api/mock-api';
import { createQueryClient } from '../../query/client';
import {
  useWorkspaceContext,
  WorkspaceProvider,
} from '../../query/workspace-provider';
import { InterruptedActionNotice } from './interrupted-action-notice';

it('keeps an interrupted notice after failed acknowledgement and clears it after a successful retry', async () => {
  const store = createMockStore();
  const api = createMockApi(store);
  const project = store.inventory.projects[0];
  if (!project) throw new Error('Missing fixture project');
  const worktree = project.worktrees.find((entry) => entry.available);
  if (!worktree) throw new Error('Missing fixture worktree');
  const scope = { projectId: project.id, worktreeId: worktree.id };
  const interrupted = {
    requestId: '00000000-0000-4000-8000-000000000001',
    action: 'pull' as const,
    gitState: 'The worktree has conflicts.',
  };
  let acknowledged = false;
  let fail = true;
  const readChanges = api.review.changes;
  api.review.changes = async (request) => {
    const result = await readChanges(request);
    return {
      changes: { ...result.changes, ...(!acknowledged ? { interrupted } : {}) },
    };
  };
  api.gitActions.dismissInterrupted = async (request) => {
    expect(request.requestId).toBe(interrupted.requestId);
    expect(request.worktreeId).toBe(worktree.id);
    if (fail) throw new Error('The server is unreachable.');
    acknowledged = true;
  };
  function Connected() {
    const { connection } = useWorkspaceContext();
    return connection ? (
      <Suspense>
        <InterruptedActionNotice scope={scope} />
      </Suspense>
    ) : null;
  }
  const screen = await render(
    <QueryClientProvider client={createQueryClient()}>
      <WorkspaceProvider api={api}>
        <Connected />
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  await expect
    .element(screen.getByRole('status'))
    .toMatchTextContent('The worktree has conflicts.');
  await screen.getByRole('button', { name: 'Got it' }).click();
  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('The server is unreachable.');
  await expect
    .element(screen.getByRole('status'))
    .toMatchTextContent('interrupted: pull');
  fail = false;
  await screen.getByRole('button', { name: 'Got it' }).click();
  await expect.element(screen.getByRole('status')).not.toBeInTheDocument();
});
