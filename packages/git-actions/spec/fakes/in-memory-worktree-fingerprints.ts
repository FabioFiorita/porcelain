import type { WorktreeFingerprintReader } from '../../src/ports/index.ts';

export class InMemoryWorktreeFingerprints implements WorktreeFingerprintReader {
  private readonly changes: ReadonlyMap<string, string | undefined>;

  constructor(changes: Record<string, string | undefined>) {
    this.changes = new Map(Object.entries(changes));
  }

  async all(): Promise<ReadonlyMap<string, string | undefined>> {
    return new Map(this.changes);
  }

  async selected(
    _worktreeId: string,
    paths: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    const selected = new Map<string, string>();
    for (const path of paths) {
      const fingerprint = this.changes.get(path);
      if (fingerprint !== undefined) selected.set(path, fingerprint);
    }
    return selected;
  }
}
