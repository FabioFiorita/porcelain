import type {
  ReadHeadTextInput,
  ReadHeadTextResult,
} from '../models/read-head-text.ts';
import type { HeadTextReader } from '../ports/head-text-reader.ts';

export class ReadHeadTextService {
  private readonly headTextReader: HeadTextReader;

  constructor(headTextReader: HeadTextReader) {
    this.headTextReader = headTextReader;
  }

  execute(
    input: ReadHeadTextInput,
    signal?: AbortSignal,
  ): Promise<ReadHeadTextResult> {
    return this.headTextReader.readHeadText(input, signal);
  }
}
