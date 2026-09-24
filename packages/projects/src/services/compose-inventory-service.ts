import type {
  ComposeInventoryInput,
  ComposeInventoryResult,
} from '../models/compose-inventory.ts';
import { projectReport } from '../rules/project-report.ts';

export class ComposeInventoryService {
  execute(input: ComposeInventoryInput): ComposeInventoryResult {
    const listings = new Map(
      input.listings.map((listing) => [listing.projectId, listing]),
    );
    return {
      environmentId: input.inventory.environmentId,
      projects: input.inventory.projects.flatMap((project) => {
        const listing = listings.get(project.id);
        return listing ? [projectReport(project, listing, input.statuses)] : [];
      }),
    };
  }
}
