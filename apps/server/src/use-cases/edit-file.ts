import { FileInspectionError } from '../filesystem/errors/file-inspection-error.ts';
import type { FileWriter } from '../filesystem/interfaces/file-writer.ts';
import type { FileEdit } from '../models/file-edit.ts';
import { resolveReadableWorktree } from './resolve-readable-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';
import { validateFilePath } from './validate-file-path.ts';

export class EditFile {
  private readonly worktrees: ResolveWorktree;
  private readonly files: FileWriter;
  constructor(worktrees: ResolveWorktree, files: FileWriter) {
    this.worktrees = worktrees;
    this.files = files;
  }
  async execute(worktreeId: string, command: FileEdit, signal?: AbortSignal) {
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
    const worktree = await resolveReadableWorktree(
      this.worktrees,
      worktreeId,
      signal,
    );
    return this.files.edit(worktree.path, command, signal);
  }
}
