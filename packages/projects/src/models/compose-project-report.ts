import type { ProjectReport } from './inventory-report.ts';
import type { ProjectName } from './project.ts';
import type { ProjectWorktrees } from './project-worktrees.ts';
import type { WorktreeStatuses } from '@porcelain/kernel/models';

export type ComposeProjectReportInput = {
  project: ProjectName;
  worktrees: ProjectWorktrees;
  statuses: WorktreeStatuses;
};

export type ComposeProjectReportResult = ProjectReport;
