import type { ChangeLinesReader } from '@porcelain/changes/ports';
import type { FileReader } from '@porcelain/files/ports';
import type { InspectionCheckouts } from './inspection-checkouts.ts';

export class ChangeLinesAdapter implements ChangeLinesReader {
  private readonly checkouts: InspectionCheckouts;
  private readonly files: FileReader;

  constructor(checkouts: InspectionCheckouts, files: FileReader) {
    this.checkouts = checkouts;
    this.files = files;
  }

  async readHeadText(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const { git } = await this.checkouts.open(worktreeId, signal);
    return (
      await git.readLines(
        { path, from: 1, to: Number.MAX_SAFE_INTEGER },
        signal,
      )
    ).join('\n');
  }

  async readWorktreeText(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const { worktree } = await this.checkouts.open(worktreeId, signal);
    const file = await this.files.read(
      { worktreeId, root: worktree.path, path },
      signal,
    );
    return file.text;
  }
}
