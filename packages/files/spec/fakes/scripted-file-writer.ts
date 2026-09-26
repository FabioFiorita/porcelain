import type { FileWrite } from '../../src/models/file-write.ts';
import type { FileWriter } from '../../src/ports/file-writer.ts';

export class ScriptedFileWriter implements FileWriter {
  private readonly outcome: FileWrite;

  constructor(outcome: FileWrite) {
    this.outcome = outcome;
  }

  write(): Promise<FileWrite> {
    return Promise.resolve(this.outcome);
  }

  create(): Promise<FileWrite> {
    return Promise.resolve(this.outcome);
  }

  move(): Promise<FileWrite> {
    return Promise.resolve(this.outcome);
  }

  trash(): Promise<FileWrite> {
    return Promise.resolve(this.outcome);
  }
}
