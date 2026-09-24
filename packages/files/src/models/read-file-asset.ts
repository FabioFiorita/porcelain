export type ReadFileAssetInput = {
  worktreeId: string;
  path: string;
};

export type ReadFileAssetResult = {
  path: string;
  mediaType: string;
  base64: string;
};

export type ReadFileAssetOptions = {
  maxBytes: number;
  base64ChunkBytes: number;
};
