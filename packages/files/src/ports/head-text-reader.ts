import type { FileReadInput, TextRead } from '../models/file-read.ts';

export interface HeadTextReader {
  readText(input: FileReadInput, signal?: AbortSignal): Promise<TextRead>;
}
