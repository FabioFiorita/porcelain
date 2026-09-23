import { describe, expect, it } from 'vitest';
import { ReconcileReviewedFilesService } from './reconcile-reviewed-files-service.ts';
import { fileChange, modified } from '../../spec/fakes/comparisons.ts';
import { InMemoryReviewedFileStore } from '../../spec/fakes/in-memory-reviewed-file-store.ts';

describe('ReconcileReviewedFilesService', () => {
  it('reconciles reviewed marks against the fingerprinted changes only', () => {
    const store = new InMemoryReviewedFileStore();
    new ReconcileReviewedFilesService(store).execute({
      worktreeId: 'w',
      changes: [
        fileChange('a.md', [modified('unstaged', 'a.md')], 'f'.repeat(64)),
        fileChange('b.md', [modified('unstaged', 'b.md')]),
      ],
    });
    expect(Object.fromEntries(store.reconciled.get('w') ?? [])).toEqual({
      'a.md': 'f'.repeat(64),
    });
  });
});
