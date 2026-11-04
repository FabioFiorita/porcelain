import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { gitRead } from '../../shared/commands/run-git.ts';
import { isOid } from '../../shared/parsers/oid.ts';
import { InvalidHistoryRequestError } from '../../shared/errors/invalid-history-request-error.ts';

export const readModuleSnapshot = Effect.fn('Git.readModuleSnapshot')(
  function* (
    input: { commonDirectory: string; oid: string },
    limits: GitLimits,
  ) {
    if (!isOid(input.oid))
      return yield* Effect.fail(new InvalidHistoryRequestError());
    const tree = yield* gitRead(
      input.commonDirectory,
      ['ls-tree', '-r', '-z', input.oid],
      limits,
    );
    const files = tree
      .toString('utf8')
      .split('\0')
      .flatMap((entry) => {
        const match = /^(100644|100755) blob ([a-f0-9]+)\t(.+)$/.exec(entry);
        const path = match?.[3];
        return path &&
          !path.startsWith('/') &&
          !path.split('/').includes('..') &&
          /\.(?:[cm]?[jt]sx?|json)$/.test(path)
          ? [{ path, oid: match?.[2] ?? '' }]
          : [];
      });
    if (files.length === 0) return [];
    const result: { path: string; text: string }[] = [];
    for (let start = 0; start < files.length; start += 64) {
      const batch = files.slice(start, start + 64);
      const blobs = yield* gitRead(
        input.commonDirectory,
        ['cat-file', '--batch'],
        limits,
        {
          input: Buffer.from(batch.map((file) => file.oid).join('\n') + '\n'),
          maxBytes: limits.inspection.trackedPathsBytes,
        },
      );
      let offset = 0;
      result.push(
        ...batch.map((file) => {
          const end = blobs.indexOf(10, offset);
          const size = Number(
            blobs.subarray(offset, end).toString('utf8').split(' ')[2],
          );
          offset = end + 1;
          const text = blobs.subarray(offset, offset + size).toString('utf8');
          offset += size + 1;
          return { path: file.path, text };
        }),
      );
    }
    return result;
  },
);
