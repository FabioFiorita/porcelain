import { ListDirectoryOptions } from '../ports/list-directory-options.ts';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { utf8ByteLength, withoutGitDirectory } from '@porcelain/kernel/rules';
import { Effect, Context, Layer } from 'effect';
import { ContentChangedError } from '../errors/content-changed-error.ts';
import { DirectoryTooLargeError } from '../errors/directory-too-large-error.ts';
import { PathNotFoundError } from '../errors/path-not-found-error.ts';
import { PathNotReadableError } from '../errors/path-not-readable-error.ts';
import { UnsupportedEntryNameError } from '../errors/unsupported-entry-name-error.ts';
import { type DirectoryEntry } from '../models/directory-entry.ts';
import { type ListFailure } from '../models/file-failure.ts';
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

export type ListDirectoryFailure = ListFailureError | DirectoryTooLargeError;

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
      function operationFailure(failure: ListFailure): ListFailureError {
        switch (failure) {
          case 'missing':
            return new PathNotFoundError();
          case 'unreadable':
            return new PathNotReadableError();
          case 'changed':
            return new ContentChangedError();
          case 'unsupported-name':
            return new UnsupportedEntryNameError();
        }
      }
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
            limit: optionsCapability.maxEntries + 1,
          });
          if (read.kind === 'failed')
            return yield* Effect.fail(operationFailure(read.failure));
          const entries = withoutGitDirectory(read.entries).toSorted(byName);
          if (read.truncated || entries.length > optionsCapability.maxEntries)
            return yield* new DirectoryTooLargeError();
          const prefix = input.path === '' ? '' : `${input.path}/`;
          const ignored = yield* ignoredEntriesReaderCapability.read({
            worktreeId: input.worktreeId,
            paths: entries.map((entry) => `${prefix}${entry.name}`),
          });
          const listing = {
            worktreeId: input.worktreeId,
            path: input.path,
            entries: entries.map((entry) =>
              ignored.has(`${prefix}${entry.name}`)
                ? { ...entry, ignored: true }
                : entry,
            ),
          };
          if (
            utf8ByteLength(JSON.stringify(listing)) >
            optionsCapability.maxResponseBytes
          )
            return yield* new DirectoryTooLargeError();
          return listing;
        }),
      };
    }),
  );
}

function byName(left: DirectoryEntry, right: DirectoryEntry) {
  if (left.name === right.name) return 0;
  return left.name < right.name ? -1 : 1;
}
