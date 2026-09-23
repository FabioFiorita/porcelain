export interface ReadFileAssetInput {
  worktreeId: string;
  path: string;
}

export interface ReadFileAssetResult {
  path: string;
  mediaType: string;
  base64: string;
}
