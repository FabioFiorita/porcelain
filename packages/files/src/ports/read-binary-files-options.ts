import { Context } from 'effect';
import type { ReadBinaryFilesOptions as ReadBinaryFilesOptionsShape } from '../models/read-binary-files.ts';
export const ReadBinaryFilesOptions = Context.Service<
  '@porcelain/files/ReadBinaryFilesOptions',
  ReadBinaryFilesOptionsShape
>('@porcelain/files/ReadBinaryFilesOptions');
