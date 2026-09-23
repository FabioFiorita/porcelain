import type { ChangeLinesReader } from '@porcelain/changes/ports';
import type { InspectionCheckouts } from './inspection-checkouts.ts';

type TextFileReading = {
  execute(
    input: { worktreeId: string; path: string },
    signal?: AbortSignal,
  ): Promise<{ text: string }>;
};

export class ChangeLinesAdapter implements ChangeLinesReader {
  private readonly checkouts: InspectionCheckouts;
  private readonly readTextFile: TextFileReading;

  constructor(checkouts: InspectionCheckouts, readTextFile: TextFileReading) {
    this.checkouts = checkouts;
    this.readTextFile = readTextFile;
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
    return (await this.readTextFile.execute({ worktreeId, path }, signal)).text;
  }
}
