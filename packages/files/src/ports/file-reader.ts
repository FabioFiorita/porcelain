import type { FileRead, FileReadInput, TextRead } from '../models/file-read.ts';

export interface FileReader {
  read(input: FileReadInput, signal?: AbortSignal): Promise<FileRead>;
  readText(input: FileReadInput, signal?: AbortSignal): Promise<TextRead>;
}
