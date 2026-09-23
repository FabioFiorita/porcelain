import type { ProjectFolderResponse } from '@porcelain/contracts/projects';

type BrowseProjectFolders = (
  path?: string,
  signal?: AbortSignal,
) => Promise<ProjectFolderResponse>;

export class BrowseProjectFoldersController {
  private readonly browseProjectFolders: BrowseProjectFolders;

  constructor(browseProjectFolders: BrowseProjectFolders) {
    this.browseProjectFolders = browseProjectFolders;
  }

  execute(
    input: { path?: string | undefined },
    context: { signal?: AbortSignal },
  ): Promise<ProjectFolderResponse> {
    return this.browseProjectFolders(input.path, context.signal);
  }
}
