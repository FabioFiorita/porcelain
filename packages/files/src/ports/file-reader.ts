import type {
  DirectoryListing,
  FileTarget,
  TextContent,
} from '../models/file-content.ts';

export type IgnoredEntries = (
  paths: readonly string[],
  signal?: AbortSignal,
) => Promise<Set<string>>;

export interface FileReader {
  list(
    target: FileTarget,
    ignored?: IgnoredEntries,
    signal?: AbortSignal,
  ): Promise<DirectoryListing>;
  read(target: FileTarget, signal?: AbortSignal): Promise<TextContent>;
}

export interface ByteReader {
  readBytes(
    target: FileTarget,
    limit: number,
    signal?: AbortSignal,
  ): Promise<Buffer>;
}
