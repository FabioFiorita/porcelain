import type {
  ReadHeadTextInput,
  ReadHeadTextResult,
} from '@porcelain/changes/models';
import type { HeadTextReader } from '@porcelain/changes/ports';
import type { OpenInspection } from './inspection-checkouts.ts';

export class GitHeadTextReader implements HeadTextReader {
  private readonly open: OpenInspection;

  constructor(open: OpenInspection) {
    this.open = open;
  }

  async readHeadText(
    input: ReadHeadTextInput,
    signal?: AbortSignal,
  ): Promise<ReadHeadTextResult> {
    const { git } = await this.open(input.worktreeId, signal);
    const lines = await git.readLines(
      { path: input.path, from: 1, to: Number.MAX_SAFE_INTEGER },
      signal,
    );
    return { text: lines.join('\n') };
  }
}
