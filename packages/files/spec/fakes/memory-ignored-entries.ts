import type { IgnoredEntriesReader } from '../../src/ports/index.ts';

export class MemoryIgnoredEntries implements IgnoredEntriesReader {
  private readonly ignored: ReadonlySet<string>;

  constructor(ignored: readonly string[] = []) {
    this.ignored = new Set(ignored);
  }

  read(
    _worktreeId: string,
    paths: readonly string[],
  ): Promise<ReadonlySet<string>> {
    return Promise.resolve(
      new Set(paths.filter((path) => this.ignored.has(path))),
    );
  }
}
