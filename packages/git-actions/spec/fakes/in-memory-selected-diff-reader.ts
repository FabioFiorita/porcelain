import { Effect } from 'effect';
import type { SelectedDiffRequest } from '../../src/models/commit-draft-evidence.ts';
import type { SelectedDiffReader } from '../../src/ports/selected-diff-reader.ts';

export class InMemorySelectedDiffReader implements SelectedDiffReader {
  private readonly patches: Readonly<Record<string, string>>;

  constructor(patches: Readonly<Record<string, string>>) {
    this.patches = patches;
  }

  read(input: SelectedDiffRequest): Effect.Effect<string> {
    return Effect.sync(() => {
      return input.paths.map((path) => this.patches[path] ?? '').join('');
    });
  }
}
