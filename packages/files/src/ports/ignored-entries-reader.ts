import type { IgnoredEntriesReadInput } from '../models/ignored-entries-read.ts';

export interface IgnoredEntriesReader {
  read(
    input: IgnoredEntriesReadInput,
    signal?: AbortSignal,
  ): Promise<ReadonlySet<string>>;
}
