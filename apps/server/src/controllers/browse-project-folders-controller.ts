import type { BrowseProjectFoldersResponse } from '@porcelain/contracts/projects';

type BrowseProjectFolders = (
  path?: string,
  signal?: AbortSignal,
) => Promise<BrowseProjectFoldersResponse>;

export class BrowseProjectFoldersController {
  private readonly browseProjectFolders: BrowseProjectFolders;

  constructor(browseProjectFolders: BrowseProjectFolders) {
    this.browseProjectFolders = browseProjectFolders;
  }

  execute(
    input: { path?: string | undefined },
    context: { signal?: AbortSignal },
  ): Promise<BrowseProjectFoldersResponse> {
    return this.browseProjectFolders(input.path, context.signal);
  }
}
