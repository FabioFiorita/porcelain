import type { Probe } from '../probe.ts';

export default {
  decision: 'H3',
  plants:
    'use-cases/access/set-device-trust.ts writes the device table in the remote-access lane instead of the access lane',
  gate: 'arch',
  rule: 'lane-per-table:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/set-device-trust.ts',
      old: `this.lanes.run(this.laneKeys.access(),`,
      new: `this.lanes.run(this.laneKeys.remoteAccess(),`,
    },
  ],
} satisfies Probe;
