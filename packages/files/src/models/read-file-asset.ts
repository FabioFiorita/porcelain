export type ReadFileAssetInput = {
  worktreeId: string;
  path: string;
};

export type ReadFileAssetResult = {
  path: string;
  mediaType: string;
  base64: string;
};
