import { Context } from 'effect';
import type { ReadTextFilesOptions as ReadTextFilesOptionsShape } from '../models/read-text-files.ts';
export const ReadTextFilesOptions = Context.Service<
  '@porcelain/files/ReadTextFilesOptions',
  ReadTextFilesOptionsShape
>('@porcelain/files/ReadTextFilesOptions');
