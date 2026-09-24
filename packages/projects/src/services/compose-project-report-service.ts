import type {
  ComposeProjectReportInput,
  ComposeProjectReportResult,
} from '../models/compose-project-report.ts';
import { projectReport } from '../rules/project-report.ts';

export class ComposeProjectReportService {
  execute(input: ComposeProjectReportInput): ComposeProjectReportResult {
    return projectReport(input.project, input.worktrees, input.statuses);
  }
}
