import { BranchRangeReader } from '@porcelain/changes/ports';
import { Effect } from 'effect';
import { withReadLease } from '@porcelain/effects/worktree';
import { describe, expect, it } from 'vitest';
import { InMemoryBranchRangeReader } from '../../spec/fakes/in-memory-branch-range-reader.ts';
import { branchFile } from '../../spec/fixtures/branch-files.ts';
import { fingerprintBranchFile } from '@porcelain/changes/rules';
import { ReadBranchChangesService } from './read-branch-changes-service.ts';

const head = { oid: 'a'.repeat(40), ref: 'refs/heads/feature' };
const base = { ref: 'refs/heads/main', oid: 'b'.repeat(40) };
const mergeBaseOid = 'c'.repeat(40);

describe('ReadBranchChangesService', () => {
  it('lists each file under the path it ends up at, with its fingerprint', async () => {
    const renamed = branchFile({
      status: 'renamed',
      oldPath: 'old.txt',
      newPath: 'new.txt',
    });
    const deleted = branchFile({
      status: 'deleted',
      oldPath: 'gone.txt',
      newPath: undefined,
      newMode: '000000',
      newOid: undefined,
    });
    const read = Effect.runSync(
      ReadBranchChangesService.pipe(
        Effect.provide(ReadBranchChangesService.layer),
        Effect.provideService(
          BranchRangeReader,
          new InMemoryBranchRangeReader({
            ranges: {
              default: {
                kind: 'found',
                head,
                base,
                mergeBaseOid,
                commits: 3,
                files: [renamed, deleted],
              },
            },
          }),
        ),
      ),
    );
    expect(
      await Effect.runPromise(
        withReadLease('w', read.execute({ worktreeId: 'w', base: undefined })),
      ),
    ).toEqual({
      head: { oid: head.oid, branch: head.ref },
      base,
      mergeBaseOid,
      commits: 3,
      files: [
        {
          path: 'new.txt',
          oldPath: 'old.txt',
          newPath: 'new.txt',
          status: 'renamed',
          oldMode: '100644',
          newMode: '100644',
          fingerprint: fingerprintBranchFile(renamed),
        },
        {
          path: 'gone.txt',
          oldPath: 'gone.txt',
          newPath: undefined,
          status: 'deleted',
          oldMode: '100644',
          newMode: '000000',
          fingerprint: fingerprintBranchFile(deleted),
        },
      ],
    });
  });

  it('answers no base and no files when the repository has no default branch', async () => {
    const read = Effect.runSync(
      ReadBranchChangesService.pipe(
        Effect.provide(ReadBranchChangesService.layer),
        Effect.provideService(
          BranchRangeReader,
          new InMemoryBranchRangeReader({
            ranges: { default: { kind: 'no-default-base', head } },
          }),
        ),
      ),
    );
    expect(
      await Effect.runPromise(
        withReadLease('w', read.execute({ worktreeId: 'w', base: undefined })),
      ),
    ).toEqual({
      head: { oid: head.oid, branch: head.ref },
      base: undefined,
      mergeBaseOid: undefined,
      commits: 0,
      files: [],
    });
  });

  it.each([
    ['missing-base', 'BranchBaseNotFoundError'],
    ['unrelated', 'UnrelatedBranchError'],
    ['unborn', 'UnbornBranchError'],
  ] as const)('refuses a %s range with %s', async (kind, name) => {
    const read = Effect.runSync(
      ReadBranchChangesService.pipe(
        Effect.provide(ReadBranchChangesService.layer),
        Effect.provideService(
          BranchRangeReader,
          new InMemoryBranchRangeReader({
            ranges: { 'refs/heads/other': { kind } },
          }),
        ),
      ),
    );
    await expect(
      Effect.runPromise(
        withReadLease(
          'w',
          read.execute({ worktreeId: 'w', base: 'refs/heads/other' }),
        ),
      ),
    ).rejects.toMatchObject({ name });
  });
});
