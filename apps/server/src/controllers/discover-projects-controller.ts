import type { ProjectDiscoveryResponse } from '@porcelain/contracts/projects';

type DiscoverProjects = (
  signal?: AbortSignal,
) => Promise<ProjectDiscoveryResponse>;

export class DiscoverProjectsController {
  private readonly discoverProjects: DiscoverProjects;

  constructor(discoverProjects: DiscoverProjects) {
    this.discoverProjects = discoverProjects;
  }

  execute(context: {
    signal?: AbortSignal;
  }): Promise<ProjectDiscoveryResponse> {
    return this.discoverProjects(context.signal);
  }
}
