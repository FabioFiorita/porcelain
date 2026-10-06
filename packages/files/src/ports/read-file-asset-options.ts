import { Context } from 'effect';
import type { ReadFileAssetOptions as ReadFileAssetOptionsShape } from '../models/read-file-asset.ts';
export const ReadFileAssetOptions = Context.Service<
  '@porcelain/files/ReadFileAssetOptions',
  ReadFileAssetOptionsShape
>('@porcelain/files/ReadFileAssetOptions');
