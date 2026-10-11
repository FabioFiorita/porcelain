import { Context } from 'effect';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type { JobRunner } from './job-runner.ts';
export const InventoryScan = Context.Service<
  '@porcelain/server/InventoryScan',
  JobRunner<ProjectNotFoundError>
>('@porcelain/server/InventoryScan');
