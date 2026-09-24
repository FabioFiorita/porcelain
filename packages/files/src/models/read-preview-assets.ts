import type { PreviewAsset } from './preview-asset.ts';

export type ReadPreviewAssetsInput = {
  worktreeId: string;
  document: string;
  paths: readonly string[];
};

export type ReadPreviewAssetsResult = {
  assets: PreviewAsset[];
};
