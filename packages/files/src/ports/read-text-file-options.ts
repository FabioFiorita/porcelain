import { Context } from 'effect';
import type { ReadTextFileOptions as ReadTextFileOptionsShape } from '../models/read-text-file.ts';
export const ReadTextFileOptions = Context.Service<
  '@porcelain/files/ReadTextFileOptions',
  ReadTextFileOptionsShape
>('@porcelain/files/ReadTextFileOptions');
