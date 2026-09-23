import type { DiscoverProjectsResponse } from '@porcelain/contracts/projects';

type DiscoverProjects = (
  signal?: AbortSignal,
) => Promise<DiscoverProjectsResponse>;

export class DiscoverProjectsController {
  private readonly discoverProjects: DiscoverProjects;

  constructor(discoverProjects: DiscoverProjects) {
    this.discoverProjects = discoverProjects;
  }

  execute(context: {
    signal?: AbortSignal;
  }): Promise<DiscoverProjectsResponse> {
    return this.discoverProjects(context.signal);
  }
}
