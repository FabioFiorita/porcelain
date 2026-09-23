import type {
  ChangeDiffsRequest,
  ChangeDiffsResponse,
} from '@porcelain/contracts/changes';
import type { ReadChangeDiffsService } from '@porcelain/changes/services';

type RunWorktreeRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class ReadChangeDiffsController {
  private readonly createRead: (worktreeId: string) => ReadChangeDiffsService;
  private readonly runRead: RunWorktreeRead;

  constructor(
    createRead: (worktreeId: string) => ReadChangeDiffsService,
    runRead: RunWorktreeRead,
  ) {
    this.createRead = createRead;
    this.runRead = runRead;
  }

  execute(
    input: ChangeDiffsRequest & { worktreeId: string },
    context: { signal?: AbortSignal },
  ): Promise<ChangeDiffsResponse> {
    const { worktreeId, expectedStatusToken } = input;
    const expectedFiles = input.expectedFiles.map((file) => ({ ...file }));
    const selections = input.selections.map((selection) => ({ ...selection }));
    return this.runRead(
      worktreeId,
      (signal) =>
        this.createRead(worktreeId).execute(
          worktreeId,
          expectedStatusToken,
          expectedFiles,
          selections,
          signal,
        ),
      context.signal,
    );
  }
}
