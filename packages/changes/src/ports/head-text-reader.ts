import type {
  ReadHeadTextInput,
  ReadHeadTextResult,
} from '../models/read-head-text.ts';

export interface HeadTextReader {
  readHeadText(
    input: ReadHeadTextInput,
    signal?: AbortSignal,
  ): Promise<ReadHeadTextResult>;
}
