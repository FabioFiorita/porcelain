import type { PreviewAsset } from './preview-asset.ts';

export type ReadPreviewAssetsInput = {
  worktreeId: string;
  document: string;
  paths: readonly string[];
};

export type ReadPreviewAssetsResult = {
  assets: PreviewAsset[];
};

export type ReadPreviewAssetsOptions = {
  maxAssetBytes: number;
  maxTotalBytes: number;
  maxPathLength: number;
  base64ChunkBytes: number;
};
