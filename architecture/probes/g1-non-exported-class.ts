import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'use-cases/access/read-health.ts: a second, non-exported class HealthReply used inside the lane',
  gate: 'lint',
  rule: 'porcelain(operation-class-members)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: `        const { environmentId } = this.readEnvironment.execute();
        return { status: 'ok', environmentId };`,
      new: `        return new HealthReply(
          this.readEnvironment.execute().environmentId,
        ).body();`,
    },
    {
      kind: 'append',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      content: `
class HealthReply {
  private readonly environmentId: string;

  constructor(environmentId: string) {
    this.environmentId = environmentId;
  }

  body(): ReadHealthResponse {
    return { status: 'ok', environmentId: this.environmentId };
  }
}
`,
    },
  ],
} satisfies Probe;
