import type { WorktreeRead } from '@porcelain/effects/worktree';
import { utf8ByteLength, withoutGitDirectory } from '@porcelain/kernel/rules';
import { Effect } from 'effect';
import { ContentChangedError } from '../errors/content-changed-error.ts';
import { DirectoryTooLargeError } from '../errors/directory-too-large-error.ts';
import { PathNotFoundError } from '../errors/path-not-found-error.ts';
import { PathNotReadableError } from '../errors/path-not-readable-error.ts';
import { UnsupportedEntryNameError } from '../errors/unsupported-entry-name-error.ts';
import type { DirectoryEntry } from '../models/directory-entry.ts';
import type { ListFailure } from '../models/file-failure.ts';
import type {
  ListDirectoryInput,
  ListDirectoryOptions,
  ListDirectoryResult,
} from '../models/list-directory.ts';
import type { DirectoryReader } from '../ports/directory-reader.ts';
import type { IgnoredEntriesReader } from '../ports/ignored-entries-reader.ts';

type ListFailureError =
  | PathNotFoundError
  | PathNotReadableError
  | ContentChangedError
  | UnsupportedEntryNameError;

export type ListDirectoryFailure = ListFailureError | DirectoryTooLargeError;

export class ListDirectoryService {
  private readonly directoryReader: DirectoryReader;
  private readonly ignoredEntriesReader: IgnoredEntriesReader;
  private readonly options: ListDirectoryOptions;

  constructor(
    directoryReader: DirectoryReader,
    ignoredEntriesReader: IgnoredEntriesReader,
    options: ListDirectoryOptions,
  ) {
    this.directoryReader = directoryReader;
    this.ignoredEntriesReader = ignoredEntriesReader;
    this.options = options;
  }

  execute(
    input: ListDirectoryInput,
  ): Effect.Effect<ListDirectoryResult, ListDirectoryFailure, WorktreeRead> {
    return Effect.gen({ self: this }, function* () {
      const read = yield* this.directoryReader.list({
        worktreeId: input.worktreeId,
        path: input.path,
        limit: this.options.maxEntries + 1,
      });
      if (read.kind === 'failed')
        return yield* Effect.fail(this.failure(read.failure));
      const entries = withoutGitDirectory(read.entries).toSorted(byName);
      if (read.truncated || entries.length > this.options.maxEntries)
        return yield* new DirectoryTooLargeError();
      const prefix = input.path === '' ? '' : `${input.path}/`;
      const ignored = yield* this.ignoredEntriesReader.read({
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
        utf8ByteLength(JSON.stringify(listing)) > this.options.maxResponseBytes
      )
        return yield* new DirectoryTooLargeError();
      return listing;
    });
  }

  private failure(failure: ListFailure): ListFailureError {
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
}

function byName(left: DirectoryEntry, right: DirectoryEntry) {
  if (left.name === right.name) return 0;
  return left.name < right.name ? -1 : 1;
}
