// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { createMockStore } from '../api/inventory/mock';
import type { ReviewSummary } from '../domain/review';
import { createQueryClient } from './client';
import { useReviewSummaries } from './review-summaries';

const context = vi.hoisted(() => ({
  api: { review: { summary: vi.fn() } },
  connection: {
    environmentId: 'fixture',
    request: (signal: AbortSignal) => ({ token: 'fixture', signal }),
  },
}));
vi.mock('./workspace-provider', () => ({ useConnectedContext: () => context }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('limits background requests to one and continues after a failed summary', async () => {
  const inventory = createMockStore().inventory;
  let rejectFirst!: (error: Error) => void;
  const first = new Promise<ReviewSummary>((_resolve, reject) => {
    rejectFirst = reject;
  });
  context.api.review.summary
    .mockImplementationOnce(() => first)
    .mockImplementation(async ({ worktreeId }: { worktreeId: string }) => ({
      worktreeId,
      pendingFiles: 0,
      openThreads: 0,
    }));
  const client = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useReviewSummaries(inventory), {
    wrapper,
  });
  try {
    await waitFor(() =>
      expect(context.api.review.summary).toHaveBeenCalledTimes(1),
    );
    expect(result.current.summaries.size).toBe(0);
    rejectFirst(new Error('Unavailable worktree'));
    const count = inventory.projects
      .flatMap((project) => project.worktrees)
      .filter((worktree) => worktree.available).length;
    await waitFor(() => expect(result.current.summaries.size).toBe(count - 1));
    expect(context.api.review.summary).toHaveBeenCalledTimes(count);
  } finally {
    unmount();
    client.clear();
  }
});
