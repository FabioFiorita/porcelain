import { Effect } from 'effect';
import type { FileWrite } from '../../src/models/file-write.ts';
import type { FileWriter } from '../../src/ports/file-writer.ts';

export class ScriptedFileWriter implements FileWriter {
  private readonly outcome: FileWrite;

  constructor(outcome: FileWrite) {
    this.outcome = outcome;
  }

  write(): Effect.Effect<FileWrite> {
    return Effect.succeed(this.outcome);
  }

  create(): Effect.Effect<FileWrite> {
    return Effect.succeed(this.outcome);
  }

  move(): Effect.Effect<FileWrite> {
    return Effect.succeed(this.outcome);
  }

  trash(): Effect.Effect<FileWrite> {
    return Effect.succeed(this.outcome);
  }

  copy(): Effect.Effect<FileWrite> {
    return Effect.succeed(this.outcome);
  }
}
