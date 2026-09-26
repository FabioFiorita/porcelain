import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'use-cases/access/read-health.ts: execute written as a public arrow-function field',
  gate: 'lint',
  rule: 'porcelain(operation-class-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: `  execute(context: OperationContext): Promise<ReadHealthResponse> {
    return this.lanes.run(
      this.laneKeys.access(),
      'read',
      async () => {
        const { environmentId } = this.readEnvironment.execute();
        return { status: 'ok', environmentId };
      },
      { callerSignal: context.signal },
    );
  }`,
      new: `  readonly execute = (
    context: OperationContext,
  ): Promise<ReadHealthResponse> =>
    this.lanes.run(
      this.laneKeys.access(),
      'read',
      async () => {
        const { environmentId } = this.readEnvironment.execute();
        return { status: 'ok', environmentId };
      },
      { callerSignal: context.signal },
    );`,
    },
  ],
} satisfies Probe;
