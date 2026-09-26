import type { Probe } from '../probe.ts';

export default {
  decision: 'N0',
  plants:
    'use-cases/access/read-health.ts: two execute overload signatures plus the implementation',
  gate: 'lint',
  rule: 'porcelain(operation-class-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: `  execute(context: OperationContext): Promise<ReadHealthResponse> {
`,
      new: `  execute(context: OperationContext): Promise<ReadHealthResponse>;
  execute(
    context: OperationContext,
    verbose: boolean,
  ): Promise<ReadHealthResponse>;
  execute(
    context: OperationContext,
    verbose?: boolean,
  ): Promise<ReadHealthResponse> {
    if (verbose)
      return Promise.resolve({ status: 'ok', environmentId: 'verbose' });
`,
    },
  ],
} satisfies Probe;
