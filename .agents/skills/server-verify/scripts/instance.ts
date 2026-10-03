import { z } from 'zod';
import { Registry } from './core/registry.ts';

export const STALE_BUILD =
  'server or CLI code changed since start, run start again';

export const registry = new Registry({
  name: 'server',
  cli: new URL('./cli.ts', import.meta.url).href,
  detail: z.object({
    address: z.string(),
    manifestPath: z.string(),
    projectId: z.string(),
    worktreeId: z.string(),
    repository: z.string(),
    projectHome: z.string(),
    logFile: z.string(),
  }),
  inputs: { roots: [], apps: [] },
  format: 'json',
  stale: (_instance, changed) => (changed ? STALE_BUILD : undefined),
  stopWithinMs: 15_000,
});

export type ServerInstance = ReturnType<typeof registry.chosen>;
