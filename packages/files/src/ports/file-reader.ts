import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { Effect } from 'effect';
import type { FileRead, FileReadInput, TextRead } from '../models/file-read.ts';

export interface FileReader {
  read(input: FileReadInput): Effect.Effect<FileRead, never, WorktreeRead>;
  readText(input: FileReadInput): Effect.Effect<TextRead, never, WorktreeRead>;
}
