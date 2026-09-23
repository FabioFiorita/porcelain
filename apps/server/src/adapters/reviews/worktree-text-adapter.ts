import type { WorktreeTextReader } from '@porcelain/reviews/ports';

type TextFileReading = {
  execute(
    input: { worktreeId: string; path: string },
    signal?: AbortSignal,
  ): Promise<{ text: string }>;
};

export class WorktreeTextAdapter implements WorktreeTextReader {
  private readonly readTextFile: TextFileReading;

  constructor(readTextFile: TextFileReading) {
    this.readTextFile = readTextFile;
  }

  async read(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<string> {
    return (await this.readTextFile.execute({ worktreeId, path }, signal)).text;
  }
}
