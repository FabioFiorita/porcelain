import { Effect } from 'effect';
import type { IgnoredEntriesReader } from '../../src/ports/ignored-entries-reader.ts';

export class InMemoryIgnoredEntriesReader implements IgnoredEntriesReader {
  private readonly ignored: ReadonlySet<string>;

  constructor(ignored: readonly string[] = []) {
    this.ignored = new Set(ignored);
  }

  read(): Effect.Effect<ReadonlySet<string>> {
    return Effect.succeed(this.ignored);
  }
}
