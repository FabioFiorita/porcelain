import { Schema } from 'effect';
import { Registry } from '../../verify-core/registry.ts';
export const STALE_BUILD =
  'server or CLI code changed since start, run start again';
export const registry = new Registry({
  name: 'server',
  cli: new URL('./cli.ts', import.meta.url).href,
  detail: Schema.Struct({
    address: Schema.String,
    manifestPath: Schema.String,
    projectId: Schema.String,
    worktreeId: Schema.String,
    repository: Schema.String,
    projectHome: Schema.String,
    logFile: Schema.String,
  }),
  inputs: { roots: [], apps: [] },
  format: 'json',
  stale: (_instance, changed) => (changed ? STALE_BUILD : undefined),
  stopWithinMs: 15_000,
});
export type ServerInstance = ReturnType<typeof registry.chosen>;
