import { utf8ByteLength, withoutGitDirectory } from '@porcelain/kernel/rules';
import { DirectoryTooLargeError } from '../errors/directory-too-large-error.ts';
import { fileFailureError } from '../errors/file-failure-error.ts';
import type { DirectoryEntry } from '../models/directory-entry.ts';
import type {
  ListDirectoryInput,
  ListDirectoryOptions,
  ListDirectoryResult,
} from '../models/list-directory.ts';
import type { DirectoryReader } from '../ports/directory-reader.ts';
import type { IgnoredEntriesReader } from '../ports/ignored-entries-reader.ts';

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

  async execute(
    input: ListDirectoryInput,
    signal?: AbortSignal,
  ): Promise<ListDirectoryResult> {
    const read = await this.directoryReader.list(
      {
        worktreeId: input.worktreeId,
        path: input.path,
        limit: this.options.maxEntries + 1,
      },
      signal,
    );
    if (read.kind === 'failed') throw fileFailureError(read.failure);
    const entries = withoutGitDirectory(read.entries).toSorted(byName);
    if (read.truncated || entries.length > this.options.maxEntries)
      throw new DirectoryTooLargeError();
    const prefix = input.path === '' ? '' : `${input.path}/`;
    const ignored = await this.ignoredEntriesReader.read(
      {
        worktreeId: input.worktreeId,
        paths: entries.map((entry) => `${prefix}${entry.name}`),
      },
      signal,
    );
    const listing = {
      worktreeId: input.worktreeId,
      path: input.path,
      entries: entries.map((entry) =>
        ignored.has(`${prefix}${entry.name}`)
          ? { ...entry, ignored: true }
          : entry,
      ),
    };
    if (utf8ByteLength(JSON.stringify(listing)) > this.options.maxResponseBytes)
      throw new DirectoryTooLargeError();
    return listing;
  }
}

function byName(left: DirectoryEntry, right: DirectoryEntry) {
  if (left.name === right.name) return 0;
  return left.name < right.name ? -1 : 1;
}
