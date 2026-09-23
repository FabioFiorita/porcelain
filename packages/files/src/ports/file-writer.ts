import type { FileEdit, FileEditResult } from '../models/file-edit.ts';

export interface FileWriter {
  edit(
    root: string,
    command: FileEdit,
    signal?: AbortSignal,
  ): Promise<FileEditResult>;
}
