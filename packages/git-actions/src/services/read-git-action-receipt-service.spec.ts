import { GitActionNotFoundError } from '@porcelain/git-actions/errors';
import { describe, expect, it } from 'vitest';
import { sampleReceipt } from '../../spec/fakes/git-action-samples.ts';
import { InMemoryGitActionReceiptStore } from '../../spec/fakes/in-memory-git-action-receipt-store.ts';
import { ReadGitActionReceiptService } from './read-git-action-receipt-service.ts';

describe('ReadGitActionReceiptService', () => {
  it('shows a receipt without the request it was accepted for', () => {
    const receipt = sampleReceipt({
      state: 'rejected',
      reason: 'CHANGED_SINCE_LOOKED',
      finishedAt: '2026-09-01T10:00:01.000Z',
    });
    const view = new ReadGitActionReceiptService(
      new InMemoryGitActionReceiptStore([receipt]),
    ).execute({ requestId: receipt.requestId });
    expect(view).toEqual({
      requestId: receipt.requestId,
      projectId: receipt.projectId,
      worktreeId: receipt.worktreeId,
      action: receipt.action,
      state: 'rejected',
      reason: 'CHANGED_SINCE_LOOKED',
      progress: [],
      acceptedAt: receipt.acceptedAt,
      finishedAt: '2026-09-01T10:00:01.000Z',
    });
  });

  it('does not find a request it never accepted', () => {
    expect(() =>
      new ReadGitActionReceiptService(
        new InMemoryGitActionReceiptStore(),
      ).execute({
        requestId: 'e0c7a0f4-3b1c-4b58-9a57-4b3cf6f6b0d1',
      }),
    ).toThrow(GitActionNotFoundError);
  });
});
