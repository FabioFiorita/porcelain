import type { Probe } from '../probe.ts';

export default {
  decision: 'S3',
  plants:
    "use-cases/projects/set-file-preference.ts: the write lane replaced by an empty 'read' lane; setFilePreference.execute called after it, outside any lane",
  gate: 'arch',
  rule: 'lane-mode-matches-service',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/projects/set-file-preference.ts',
      old: `    const result = await this.lanes.run(
      this.laneKeys.project(input.projectId),
      'write',
      async () => this.setFilePreference.execute(input),
      { callerSignal: context.signal },
    );`,
      new: `    await this.lanes.run(
      this.laneKeys.project(input.projectId),
      'read',
      async () => undefined,
      { callerSignal: context.signal },
    );
    const result = this.setFilePreference.execute(input);`,
    },
  ],
} satisfies Probe;
