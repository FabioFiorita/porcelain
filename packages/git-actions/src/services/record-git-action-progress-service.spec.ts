import { describe, expect, it } from 'vitest';
import { sampleReceipt } from '../../spec/fakes/git-action-samples.ts';
import { InMemoryGitActionStore } from '../../spec/fakes/in-memory-git-action-store.ts';
import { RecordGitActionProgressService } from './record-git-action-progress-service.ts';

describe('RecordGitActionProgressService', () => {
  it('appends a line to a running action', () => {
    const receipt = sampleReceipt({ progress: ['Counting objects'] });
    const store = new InMemoryGitActionStore([receipt]);
    const view = new RecordGitActionProgressService(store).execute({
      requestId: receipt.requestId,
      line: 'Receiving objects',
    });
    expect(view?.progress).toEqual(['Counting objects', 'Receiving objects']);
    expect(store.read(receipt.requestId)?.progress).toEqual([
      'Counting objects',
      'Receiving objects',
    ]);
  });

  it('keeps only the most recent lines once the log is full', () => {
    const full = Array.from({ length: 200 }, (_, index) => `line ${index}`);
    const receipt = sampleReceipt({ progress: full });
    const store = new InMemoryGitActionStore([receipt]);
    const view = new RecordGitActionProgressService(store).execute({
      requestId: receipt.requestId,
      line: 'last',
    });
    expect(view?.progress).toHaveLength(full.length);
    expect(view?.progress.at(0)).toBe('line 1');
    expect(view?.progress.at(-1)).toBe('last');
  });

  it('ignores lines for an action that already settled or is unknown', () => {
    const receipt = sampleReceipt({ state: 'succeeded', finishedAt: 1 });
    const store = new InMemoryGitActionStore([receipt]);
    const service = new RecordGitActionProgressService(store);
    expect(
      service.execute({ requestId: receipt.requestId, line: 'late' }),
    ).toBeUndefined();
    expect(
      service.execute({
        requestId: 'e0c7a0f4-3b1c-4b58-9a57-4b3cf6f6b0d1',
        line: 'stray',
      }),
    ).toBeUndefined();
    expect(store.read(receipt.requestId)?.progress).toEqual([]);
  });
});
