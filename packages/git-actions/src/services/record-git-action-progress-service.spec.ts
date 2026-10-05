import {
  GitActionReceiptStore,
  RecordGitActionProgressOptions,
} from '@porcelain/git-actions/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  REQUEST_ID,
  sampleReceipt,
} from '../../spec/fixtures/git-action-samples.ts';
import { InMemoryGitActionReceiptStore } from '../../spec/fakes/in-memory-git-action-receipt-store.ts';
import { RecordGitActionProgressService } from './record-git-action-progress-service.ts';

const options = { progressLines: 3 };

describe('RecordGitActionProgressService', () => {
  it('appends a line to a running action', async () => {
    const store = new InMemoryGitActionReceiptStore([
      sampleReceipt({ progress: ['Counting objects'] }),
    ]);
    const recorded = Effect.runSync(
      Effect.runSync(
        RecordGitActionProgressService.pipe(
          Effect.provide(RecordGitActionProgressService.layer),
          Effect.provideService(GitActionReceiptStore, store),
          Effect.provideService(RecordGitActionProgressOptions, options),
        ),
      ).execute({
        requestId: REQUEST_ID,
        line: 'Receiving objects',
      }),
    );
    expect(recorded.kind === 'recorded' && recorded.receipt.progress).toEqual([
      'Counting objects',
      'Receiving objects',
    ]);
    expect(
      (await Effect.runPromise(store.read({ requestId: REQUEST_ID })))
        ?.progress,
    ).toEqual(['Counting objects', 'Receiving objects']);
  });

  it('keeps only the most recent lines once the log is full', async () => {
    const store = new InMemoryGitActionReceiptStore([
      sampleReceipt({ progress: ['one', 'two', 'three'] }),
    ]);
    Effect.runSync(
      Effect.runSync(
        RecordGitActionProgressService.pipe(
          Effect.provide(RecordGitActionProgressService.layer),
          Effect.provideService(GitActionReceiptStore, store),
          Effect.provideService(RecordGitActionProgressOptions, options),
        ),
      ).execute({
        requestId: REQUEST_ID,
        line: 'four',
      }),
    );
    expect(
      (await Effect.runPromise(store.read({ requestId: REQUEST_ID })))
        ?.progress,
    ).toEqual(['two', 'three', 'four']);
  });

  it('ignores lines for an action that already settled or is unknown', async () => {
    const store = new InMemoryGitActionReceiptStore([
      sampleReceipt({
        state: 'succeeded',
        finishedAt: '2026-09-01T10:00:01.000Z',
      }),
    ]);
    const service = Effect.runSync(
      RecordGitActionProgressService.pipe(
        Effect.provide(RecordGitActionProgressService.layer),
        Effect.provideService(GitActionReceiptStore, store),
        Effect.provideService(RecordGitActionProgressOptions, options),
      ),
    );
    expect(
      Effect.runSync(service.execute({ requestId: REQUEST_ID, line: 'late' })),
    ).toEqual({
      kind: 'not-running',
    });
    expect(
      Effect.runSync(
        service.execute({
          requestId: 'e0c7a0f4-3b1c-4b58-9a57-4b3cf6f6b0d1',
          line: 'stray',
        }),
      ),
    ).toEqual({ kind: 'not-running' });
    expect(
      (await Effect.runPromise(store.read({ requestId: REQUEST_ID })))
        ?.progress,
    ).toEqual([]);
  });
});
