import type {
  ListableProject,
  WorktreeListing,
} from '@porcelain/projects/models';
import type { ProjectWorktreeReader } from '@porcelain/projects/ports';

export class ScriptedProjectWorktreeReader implements ProjectWorktreeReader {
  private readonly listings = new Map<string, WorktreeListing>();

  answer(listing: WorktreeListing): void {
    this.listings.set(listing.projectId, listing);
  }

  async list(project: ListableProject): Promise<WorktreeListing> {
    const listing = this.listings.get(project.id);
    if (!listing) throw new Error(`No listing scripted for ${project.id}`);
    return listing;
  }

  forget(projectId: string): void {
    this.listings.delete(projectId);
  }
}
