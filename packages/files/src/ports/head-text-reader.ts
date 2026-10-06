import { type WorktreeRead } from '@porcelain/effects/worktree';
import { type Effect, Context } from 'effect';
import { type FileReadInput, type TextRead } from '../models/file-read.ts';

export interface HeadTextReader {
  readText(input: FileReadInput): Effect.Effect<TextRead, never, WorktreeRead>;
}

export const HeadTextReader = Context.Service<
  '@porcelain/files/HeadTextReader',
  HeadTextReader
>('@porcelain/files/HeadTextReader');
