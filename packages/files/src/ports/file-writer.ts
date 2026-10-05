import { type WorktreeWrite } from '@porcelain/effects/worktree';
import { type Effect, Context } from 'effect';
import { type FileLocation } from '../models/file-location.ts';
import {
  type EntryCopyInput,
  type EntryCreateInput,
  type EntryMoveInput,
  type FileWrite,
  type FileWriteInput,
} from '../models/file-write.ts';

export interface FileWriter {
  write(input: FileWriteInput): Effect.Effect<FileWrite, never, WorktreeWrite>;
  create(
    input: EntryCreateInput,
  ): Effect.Effect<FileWrite, never, WorktreeWrite>;
  move(input: EntryMoveInput): Effect.Effect<FileWrite, never, WorktreeWrite>;
  trash(input: FileLocation): Effect.Effect<FileWrite, never, WorktreeWrite>;
  copy(input: EntryCopyInput): Effect.Effect<FileWrite, never, WorktreeWrite>;
}

export const FileWriter = Context.Service<
  '@porcelain/files/FileWriter',
  FileWriter
>('@porcelain/files/FileWriter');
