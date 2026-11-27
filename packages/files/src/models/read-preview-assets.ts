import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { PreviewAsset } from './preview-asset.ts';

export type ReadPreviewAssetsInput = {
  worktreeId: string;
  document: string;
  paths: readonly string[];
  canStream?: (path: string) => Effect.Effect<boolean, never, WorktreeRead>;
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
