import type {
  EditFileRequest,
  EditFileResponse,
} from '@porcelain/contracts/files';

type EditFile = {
  execute(
    worktreeId: string,
    command: EditFileRequest,
    signal?: AbortSignal,
  ): Promise<EditFileResponse>;
};
type RunWorktreeWrite = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class EditFileController {
  private readonly editFile: EditFile;
  private readonly runWorktreeWrite: RunWorktreeWrite;
  private readonly noteFilesChanged: (
    worktreeId: string,
    paths: string[],
  ) => void;

  constructor(
    editFile: EditFile,
    runWorktreeWrite: RunWorktreeWrite,
    noteFilesChanged: (worktreeId: string, paths: string[]) => void,
  ) {
    this.editFile = editFile;
    this.runWorktreeWrite = runWorktreeWrite;
    this.noteFilesChanged = noteFilesChanged;
  }

  async execute(
    input: { worktreeId: string; command: EditFileRequest },
    context: { signal?: AbortSignal },
  ): Promise<EditFileResponse> {
    const submitted = { ...input.command };
    const result = await this.runWorktreeWrite(
      input.worktreeId,
      (signal) => this.editFile.execute(input.worktreeId, submitted, signal),
      context.signal,
    );
    const paths =
      submitted.kind === 'move'
        ? [submitted.path, submitted.destination]
        : [submitted.path];
    this.noteFilesChanged(input.worktreeId, paths);
    return result;
  }
}
