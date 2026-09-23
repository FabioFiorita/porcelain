import type { ChangeLinesReader } from '@porcelain/changes/ports';

export class InMemoryChangeLinesReader implements ChangeLinesReader {
  readonly head = new Map<string, string>();
  readonly worktree = new Map<string, string>();

  readHeadText(_worktreeId: string, path: string): Promise<string> {
    return this.text(this.head, path);
  }

  readWorktreeText(_worktreeId: string, path: string): Promise<string> {
    return this.text(this.worktree, path);
  }

  private text(files: ReadonlyMap<string, string>, path: string) {
    const text = files.get(path);
    return text === undefined
      ? Promise.reject(new Error(`No file at ${path}`))
      : Promise.resolve(text);
  }
}
