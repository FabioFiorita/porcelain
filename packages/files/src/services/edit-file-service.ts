import { validateFilePath } from '../errors/validate-file-path.ts';
import type { FileEdit, FileEditResult } from '../models/file-edit.ts';
import type { FileWriter } from '../ports/file-writer.ts';
import type { ReachableWorktreeReader } from '../ports/reachable-worktree.ts';
import { FileInspectionError } from '../errors/file-inspection-error.ts';

export class EditFileService {
  private readonly worktrees: ReachableWorktreeReader;
  private readonly files: FileWriter;

  constructor(worktrees: ReachableWorktreeReader, files: FileWriter) {
    this.worktrees = worktrees;
    this.files = files;
  }

  async execute(
    worktreeId: string,
    command: FileEdit,
    signal?: AbortSignal,
  ): Promise<FileEditResult> {
    validateFilePath(command.path, false);
    if (command.kind === 'move') validateFilePath(command.destination, false);
    if (
      command.kind === 'write' &&
      (Buffer.byteLength(command.text, 'utf8') > 1024 * 1024 ||
        command.text.includes('\0') ||
        !/^[a-f0-9]{64}$/.test(command.expectedFingerprint))
    )
      throw new FileInspectionError('INVALID_REQUEST');
    signal?.throwIfAborted();
    const worktree = await this.worktrees.reachable(worktreeId, signal);
    const result = await this.files.edit(worktree.path, command, signal);
    await this.worktrees.reachable(worktreeId, signal);
    signal?.throwIfAborted();
    return result;
  }
}
