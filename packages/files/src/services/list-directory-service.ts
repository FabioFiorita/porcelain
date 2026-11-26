import { fileFailure } from './file-failure.ts';
import { ListDirectoryOptions } from '../ports/list-directory-options.ts';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { utf8ByteLength, withoutGitDirectory } from '@porcelain/kernel/rules';
import { Effect, Context, Layer } from 'effect';
import type { ContentChangedError } from '../errors/content-changed-error.ts';
import type { PathNotFoundError } from '../errors/path-not-found-error.ts';
import type { PathNotReadableError } from '../errors/path-not-readable-error.ts';
import type { UnsupportedEntryNameError } from '../errors/unsupported-entry-name-error.ts';
import { type DirectoryEntry } from '../models/directory-entry.ts';
import {
  type ListDirectoryInput,
  type ListDirectoryResult,
} from '../models/list-directory.ts';
import { DirectoryReader } from '../ports/directory-reader.ts';
import { IgnoredEntriesReader } from '../ports/ignored-entries-reader.ts';

type ListFailureError =
  | PathNotFoundError
  | PathNotReadableError
  | ContentChangedError
  | UnsupportedEntryNameError;

export type ListDirectoryFailure = ListFailureError;

export class ListDirectoryService extends Context.Service<
  ListDirectoryService,
  {
    readonly execute: (
      input: ListDirectoryInput,
    ) => Effect.Effect<ListDirectoryResult, ListDirectoryFailure, WorktreeRead>;
  }
>()('@porcelain/files/ListDirectoryService') {
  static readonly layer = Layer.effect(
    ListDirectoryService,
    Effect.gen(function* () {
      const directoryReaderCapability = yield* DirectoryReader;
      const ignoredEntriesReaderCapability = yield* IgnoredEntriesReader;
      const optionsCapability = yield* ListDirectoryOptions;
      return {
        execute: Effect.fn('ListDirectoryService.execute')(function* (
          input: ListDirectoryInput,
        ): Effect.fn.Return<
          ListDirectoryResult,
          ListDirectoryFailure,
          WorktreeRead
        > {
          const read = yield* directoryReaderCapability.list({
            worktreeId: input.worktreeId,
            path: input.path,
            limit: optionsCapability.maxEntries,
          });
          if (read.kind === 'failed')
            return yield* Effect.fail(fileFailure[read.failure]());
          const listed = withoutGitDirectory(read.entries);
          const prefix = input.path === '' ? '' : `${input.path}/`;
          const ignored = yield* ignoredEntriesReaderCapability.read({
            worktreeId: input.worktreeId,
            paths: listed.map((entry) => `${prefix}${entry.name}`),
          });
          const flagged = listed.map((entry) =>
            ignored.has(`${prefix}${entry.name}`)
              ? { ...entry, ignored: true }
              : entry,
          );
          const shown = withinResponseBytes(
            flagged.slice(0, optionsCapability.maxEntries),
            optionsCapability.maxResponseBytes -
              utf8ByteLength(
                JSON.stringify({
                  worktreeId: input.worktreeId,
                  path: input.path,
                  entries: [],
                  omitted: Number.MAX_SAFE_INTEGER,
                }),
              ),
          );
          const omitted = read.omitted + flagged.length - shown.length;
          return {
            worktreeId: input.worktreeId,
            path: input.path,
            entries: shown.toSorted(byName),
            ...(omitted > 0 && { omitted }),
          };
        }),
      };
    }),
  );
}

function withinResponseBytes(entries: DirectoryEntry[], budget: number) {
  let used = 0;
  let count = 0;
  for (const entry of entries) {
    used += utf8ByteLength(JSON.stringify(entry)) + 1;
    if (used > budget) break;
    count += 1;
  }
  return entries.slice(0, count);
}

function byName(left: DirectoryEntry, right: DirectoryEntry) {
  if (left.name === right.name) return 0;
  return left.name < right.name ? -1 : 1;
}
