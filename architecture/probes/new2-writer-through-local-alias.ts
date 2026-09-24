import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    "use-cases/projects/set-file-preference.ts: lane mode 'read' and the writer called through a local alias `const writer = this.setFilePreference; writer.execute(input)`",
  gate: 'arch',
  rule: 'lane-mode-matches-service',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/projects/set-file-preference.ts',
      old: `      'write',
      async () => this.setFilePreference.execute(input),`,
      new: `      'read',
      async () => {
        const writer = this.setFilePreference;
        return writer.execute(input);
      },`,
    },
  ],
} satisfies Probe;
