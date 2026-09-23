export interface ReadPreviewAssetsInput {
  worktreeId: string;
  document: string;
  paths: readonly string[];
}

export type PreviewAsset =
  | { kind: 'asset'; path: string; mediaType: string; base64: string }
  | { kind: 'unavailable'; path: string };

export interface ReadPreviewAssetsResult {
  assets: PreviewAsset[];
}
