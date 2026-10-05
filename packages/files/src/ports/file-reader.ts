import { type WorktreeRead } from '@porcelain/effects/worktree';
import { type Effect, Context } from 'effect';
import {
  type FileRead,
  type FileReadInput,
  type TextRead,
} from '../models/file-read.ts';

export interface FileReader {
  read(input: FileReadInput): Effect.Effect<FileRead, never, WorktreeRead>;
  readText(input: FileReadInput): Effect.Effect<TextRead, never, WorktreeRead>;
}

export const FileReader = Context.Service<
  '@porcelain/files/FileReader',
  FileReader
>('@porcelain/files/FileReader');
