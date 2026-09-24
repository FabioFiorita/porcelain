import type { SelectedDiffRequest } from '../../src/models/commit-draft-evidence.ts';
import type { SelectedDiffReader } from '../../src/ports/selected-diff-reader.ts';

export class InMemorySelectedDiffReader implements SelectedDiffReader {
  private readonly patches: Readonly<Record<string, string>>;

  constructor(patches: Readonly<Record<string, string>>) {
    this.patches = patches;
  }

  async read(input: SelectedDiffRequest): Promise<string> {
    return input.paths.map((path) => this.patches[path] ?? '').join('');
  }
}
