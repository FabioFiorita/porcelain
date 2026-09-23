import type { ProjectReport } from '../models/inventory-report.ts';
import type { ComposeProjectReportInput } from '../models/inventory-operations.ts';
import { projectReport } from '../rules/project-report.ts';

export class ComposeProjectReportService {
  execute(input: ComposeProjectReportInput): ProjectReport {
    return projectReport(input.project, input.worktrees, input.statuses);
  }
}
