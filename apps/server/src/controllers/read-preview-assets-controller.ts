import type { PreviewAssetsResponse } from '@porcelain/contracts/files';

type ReadPreviewAssets = {
  execute(
    worktreeId: string,
    document: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<PreviewAssetsResponse['assets']>;
};
type RunWorktreeRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class ReadPreviewAssetsController {
  private readonly readPreviewAssets: ReadPreviewAssets;
  private readonly runWorktreeRead: RunWorktreeRead;

  constructor(
    readPreviewAssets: ReadPreviewAssets,
    runWorktreeRead: RunWorktreeRead,
  ) {
    this.readPreviewAssets = readPreviewAssets;
    this.runWorktreeRead = runWorktreeRead;
  }

  async execute(
    input: { worktreeId: string; document: string; paths: string[] },
    context: { signal?: AbortSignal },
  ): Promise<PreviewAssetsResponse> {
    const wanted = [...input.paths];
    const assets = await this.runWorktreeRead(
      input.worktreeId,
      (signal) =>
        this.readPreviewAssets.execute(
          input.worktreeId,
          input.document,
          wanted,
          signal,
        ),
      context.signal,
    );
    return { assets };
  }
}
