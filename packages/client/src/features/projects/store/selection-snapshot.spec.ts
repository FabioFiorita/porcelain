import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { projectSelectionSnapshotSchema } from './selection-snapshot.ts';

describe('persisted project selection', () => {
  it('round trips forgetting the current environment without losing saved worktrees', () => {
    const environmentId = '11111111-1111-4111-8111-111111111111';
    const snapshot = {
      currentEnvironmentId: undefined,
      selections: {
        [environmentId]: {
          projectId: '22222222-2222-4222-8222-222222222222',
          worktreeId: '33333333333333333333333333333333',
        },
      },
    };
    const encoded = Schema.encodeSync(projectSelectionSnapshotSchema)(snapshot);
    const decoded = Schema.decodeUnknownSync(projectSelectionSnapshotSchema)(
      JSON.parse(JSON.stringify(encoded)),
    );
    expect(decoded).toEqual(snapshot);
  });

  it('rejects a persisted selection with an invalid worktree identity', () => {
    expect(() =>
      Schema.decodeUnknownSync(projectSelectionSnapshotSchema)({
        selections: {
          '11111111-1111-4111-8111-111111111111': {
            projectId: '22222222-2222-4222-8222-222222222222',
            worktreeId: '../../elsewhere',
          },
        },
      }),
    ).toThrow();
  });

  it('rejects an invalid environment key rather than silently dropping its selection', () => {
    expect(() =>
      Schema.decodeUnknownSync(projectSelectionSnapshotSchema)({
        selections: {
          'invalid-environment': {
            projectId: '22222222-2222-4222-8222-222222222222',
            worktreeId: '33333333333333333333333333333333',
          },
        },
      }),
    ).toThrow();
  });
});
