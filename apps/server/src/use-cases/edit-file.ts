import type { GitFactory } from '@porcelain/git/interfaces/git-factory';
import { FileInspectionError } from '../filesystem/errors/file-inspection-error.ts';
import type { FileWriter } from '../filesystem/interfaces/file-writer.ts';
import type { FileEdit } from '../models/file-edit.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { resolveReadableWorktree } from './resolve-readable-worktree.ts';
import { validateFilePath } from './validate-file-path.ts';

export class EditFile {
  private readonly store: InventoryStore;
  private readonly git: GitFactory;
  private readonly files: FileWriter;
  constructor(store: InventoryStore, git: GitFactory, files: FileWriter) {
    this.store = store;
    this.git = git;
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
      this.store,
      this.git,
      worktreeId,
      signal,
    );
    return this.files.edit(worktree.path, command, signal);
  }
}
