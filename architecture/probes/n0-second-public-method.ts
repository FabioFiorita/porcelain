import type { Probe } from '../probe.ts';

export default {
  decision: 'N0',
  plants:
    'use-cases/access/read-health.ts: second public method executeForOwner() next to execute()',
  gate: 'lint',
  rule: 'porcelain(operation-class-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: '  execute(context: OperationContext): Promise<ReadHealthResponse> {',
      new: `  executeForOwner(context: OperationContext): Promise<ReadHealthResponse> {
    return this.execute(context);
  }

  execute(context: OperationContext): Promise<ReadHealthResponse> {`,
    },
  ],
} satisfies Probe;
