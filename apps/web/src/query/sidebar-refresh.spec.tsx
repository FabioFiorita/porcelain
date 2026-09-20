import { QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import type { Api } from '../api/api';
import { createMockStore } from '../api/inventory/mock';
import { createMockApi } from '../api/mock-api';
import type { ReviewScope } from '../domain/review';
import { createQueryClient } from './client';
import { useCreateComment, useReplyComment } from './comments';
import { useGitAction } from './git-actions';
import { useInventory } from './inventory';
import {
  useMarkAllReviewed,
  useMarkReviewed,
  useReviewChanges,
} from './review';
import { useWorkspaceContext, WorkspaceProvider } from './workspace-provider';

/**
 * The sidebar's dot rides with the worktree list, so anything that changes
 * what the dot says has to reach that list. A commit and an answered reply
 * depend on state only the server holds, so they ask for it again. Marking
 * does not: everything that decides the dot is already in cache, and asking
 * would make marking one file cost a listing of every project.
 */
function harness(onReads: () => void) {
  const store = createMockStore();
  const base = createMockApi(store);
  const api: Api = {
    ...base,
    inventory: {
      ...base.inventory,
      read: (options) => {
        onReads();
        return base.inventory.read(options);
      },
    },
  };
  const project = store.inventory.projects[0];
  // Not the main checkout: the fixtures give it no changes, and every one of
  // these transitions is about a worktree with review work in it.
  const worktree = project?.worktrees.find(
    (entry) => entry.available && !entry.main,
  );
  if (!project || !worktree) throw new Error('Missing fixture worktree');
  return {
    store,
    api,
    scope: { projectId: project.id, worktreeId: worktree.id } as ReviewScope,
  };
}

function Connected({ children }: { children: React.ReactNode }) {
  const { connection } = useWorkspaceContext();
  return connection ? children : null;
}

async function run(
  api: Api,
  use: () => () => Promise<unknown>,
  worktreeId?: string,
) {
  const queryClient = createQueryClient();
  function Acting() {
    const inventory = useInventory();
    const act = use();
    const dot = inventory.projects
      .flatMap((entry) => entry.worktrees)
      .find((entry) => entry.id === worktreeId)?.status;
    return (
      <>
        <button type="button" onClick={() => void act().catch(() => {})}>
          Act
        </button>
        <output aria-label="Projects">
          {inventory.projects.map((entry) => entry.name).join(', ')}
        </output>
        <output aria-label="Dot">{dot ?? 'none'}</output>
      </>
    );
  }
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider api={api}>
        <Connected>
          <Acting />
        </Connected>
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  await expect.element(screen.getByLabelText('Projects')).toBeVisible();
  return screen;
}

it('moves the dot from the mark itself, without asking for the worktree list', async () => {
  let reads = 0;
  const { api, scope } = harness(() => {
    reads += 1;
  });
  const screen = await run(
    api,
    () => {
      const mark = useMarkReviewed(scope);
      const changes = useReviewChanges(scope);
      return async () => {
        const entry = changes.find((file) => file.fingerprint);
        if (!entry?.fingerprint) throw new Error('Missing markable fixture');
        await mark.submit({ path: entry.path, fingerprint: entry.fingerprint });
      };
    },
    scope.worktreeId,
  );
  const before = reads;
  await screen.getByRole('button', { name: 'Act' }).click();
  // Layers are published and most of their files are still unmarked, so one
  // mark says pending — worked out here, not fetched.
  await expect
    .element(screen.getByLabelText('Dot'))
    .toHaveTextContent('pending');
  expect(reads).toBe(before);
});

it('asks for the worktree list again once a commit archives the layers', async () => {
  let reads = 0;
  const { api, scope } = harness(() => {
    reads += 1;
  });
  const screen = await run(api, () => {
    const git = useGitAction(scope, 'commit');
    return () => git.run({ message: 'Reviewed' });
  });
  const before = reads;
  await screen.getByRole('button', { name: 'Act' }).click();
  await vi.waitFor(() => expect(reads).toBeGreaterThan(before));
});

it('asks for the worktree list again once a reply is answered', async () => {
  let reads = 0;
  const { api, scope, store } = harness(() => {
    reads += 1;
  });
  // A thread the agent has the last word in: answering it is what the dot
  // reads as having been seen.
  const thread = {
    id: '00000000-0000-4000-8000-000000000101',
    worktreeId: scope.worktreeId,
    anchor: { kind: 'file' as const, filePath: 'README.md' },
    resolved: false,
    messages: [
      {
        id: '00000000-0000-4000-8000-000000000102',
        body: 'Renamed it as you asked.',
        author: 'agent' as const,
        createdAt: '2026-09-12T11:00:00Z',
      },
    ],
    revision: 3,
  };
  store.comments[scope.worktreeId] = [thread];
  const screen = await run(api, () => {
    const reply = useReplyComment(scope);
    return async () => {
      await reply.submit({ threadId: thread.id, body: 'Thanks' });
    };
  });
  const before = reads;
  await screen.getByRole('button', { name: 'Act' }).click();
  await vi.waitFor(() => expect(reads).toBeGreaterThan(before));
});

it('turns the dot to reviewed after marking everything, still without a list read', async () => {
  let reads = 0;
  const { api, scope } = harness(() => {
    reads += 1;
  });
  const screen = await run(
    api,
    () => {
      const markAll = useMarkAllReviewed(scope);
      const changes = useReviewChanges(scope);
      return async () => {
        const report = await markAll.submit(changes);
        if (report.marked.length < 2)
          throw new Error('Fixture marked too little to tell');
      };
    },
    scope.worktreeId,
  );
  const before = reads;
  await screen.getByRole('button', { name: 'Act' }).click();
  // Every file of every published layer is marked, so the handoff is done.
  await expect
    .element(screen.getByLabelText('Dot'))
    .toHaveTextContent('reviewed');
  expect(reads).toBe(before);
});

it('does not ask for the worktree list when a comment is only added', async () => {
  let reads = 0;
  const { api, scope } = harness(() => {
    reads += 1;
  });
  const screen = await run(api, () => {
    const create = useCreateComment(scope);
    return () =>
      create.submit({
        anchor: { kind: 'file', filePath: 'README.md' },
        body: 'Why this way?',
      });
  });
  const before = reads;
  await screen.getByRole('button', { name: 'Act' }).click();
  await vi.waitFor(() =>
    expect(screen.getByLabelText('Projects').element()).toBeTruthy(),
  );
  // A thread the owner opened says nothing new to the owner, so the list is
  // not asked for again.
  await new Promise((settle) => setTimeout(settle, 100));
  expect(reads).toBe(before);
});
