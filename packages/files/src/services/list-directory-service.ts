import { DirectoryTooLargeError } from '../errors/directory-too-large-error.ts';
import type { DirectoryEntry } from '../models/directory-listing.ts';
import type {
  ListDirectoryInput,
  ListDirectoryResult,
} from '../models/list-directory.ts';
import type { DirectoryReader } from '../ports/directory-reader.ts';
import type { IgnoredEntriesReader } from '../ports/ignored-entries-reader.ts';
import { fileFailureError } from '../rules/file-failure-error.ts';
import { serializedByteLength } from '../rules/serialized-byte-length.ts';

export type ListDirectoryOptions = {
  maxEntries: number;
  maxResponseBytes: number;
};

const LIMITS: ListDirectoryOptions = {
  maxEntries: 2000,
  maxResponseBytes: 1024 * 1024,
};

export class ListDirectoryService {
  private readonly directoryReader: DirectoryReader;
  private readonly ignoredEntriesReader: IgnoredEntriesReader;
  private readonly options: ListDirectoryOptions;

  constructor(
    directoryReader: DirectoryReader,
    ignoredEntriesReader: IgnoredEntriesReader,
    options: ListDirectoryOptions = LIMITS,
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
      input,
      this.options.maxEntries,
      signal,
    );
    if (read.kind === 'too-large') throw new DirectoryTooLargeError();
    if (read.kind === 'failed') throw fileFailureError(read.failure);
    const prefix = input.path === '' ? '' : `${input.path}/`;
    const entries = read.entries.toSorted(byName);
    const ignored = await this.ignoredEntriesReader.read(
      input.worktreeId,
      entries.map((entry) => `${prefix}${entry.name}`),
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
    if (serializedByteLength(listing) > this.options.maxResponseBytes)
      throw new DirectoryTooLargeError();
    return listing;
  }
}

function byName(left: DirectoryEntry, right: DirectoryEntry) {
  if (left.name === right.name) return 0;
  return left.name < right.name ? -1 : 1;
}
