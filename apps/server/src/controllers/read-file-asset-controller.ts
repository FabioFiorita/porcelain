import type { AssetResponse } from '@porcelain/contracts/files';

type ReadFileAsset = {
  execute(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<AssetResponse>;
};
type RunWorktreeRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class ReadFileAssetController {
  private readonly readFileAsset: ReadFileAsset;
  private readonly runWorktreeRead: RunWorktreeRead;

  constructor(readFileAsset: ReadFileAsset, runWorktreeRead: RunWorktreeRead) {
    this.readFileAsset = readFileAsset;
    this.runWorktreeRead = runWorktreeRead;
  }

  execute(
    input: { worktreeId: string; path: string },
    context: { signal?: AbortSignal },
  ): Promise<AssetResponse> {
    return this.runWorktreeRead(
      input.worktreeId,
      (signal) =>
        this.readFileAsset.execute(input.worktreeId, input.path, signal),
      context.signal,
    );
  }
}
