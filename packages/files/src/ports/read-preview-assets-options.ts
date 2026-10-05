import { Context } from 'effect';
import type { ReadPreviewAssetsOptions as ReadPreviewAssetsOptionsShape } from '../models/read-preview-assets.ts';
export const ReadPreviewAssetsOptions = Context.Service<
  '@porcelain/files/ReadPreviewAssetsOptions',
  ReadPreviewAssetsOptionsShape
>('@porcelain/files/ReadPreviewAssetsOptions');
