import { Context } from 'effect';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type { JobRunner } from './job-runner.ts';
export const InventoryRefresh = Context.Service<
  '@porcelain/server/InventoryRefresh',
  JobRunner<ProjectNotFoundError>
>('@porcelain/server/InventoryRefresh');
