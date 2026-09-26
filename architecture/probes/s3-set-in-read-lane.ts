import type { Probe } from '../probe.ts';

export default {
  decision: 'S3',
  plants:
    "use-cases/projects/set-file-preference.ts: lane mode 'write' changed to 'read' around this.setFilePreference.execute",
  gate: 'arch',
  rule: 'lane-mode-matches-service:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/projects/set-file-preference.ts',
      old: "      'write',",
      new: "      'read',",
    },
  ],
} satisfies Probe;
