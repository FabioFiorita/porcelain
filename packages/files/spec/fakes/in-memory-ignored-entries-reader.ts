import type { IgnoredEntriesReader } from '../../src/ports/ignored-entries-reader.ts';

export class InMemoryIgnoredEntriesReader implements IgnoredEntriesReader {
  private readonly ignored: ReadonlySet<string>;

  constructor(ignored: readonly string[] = []) {
    this.ignored = new Set(ignored);
  }

  read(): Promise<ReadonlySet<string>> {
    return Promise.resolve(this.ignored);
  }
}
