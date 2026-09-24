import type { Probe } from '../probe.ts';

export default {
  decision: 'H3',
  plants:
    'use-cases/reviews/list-reviewed-layers.ts publishes from inside its lanes.runConsistent callback',
  gate: 'lint',
  rule: 'porcelain(events-after-lane)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/reviews/list-reviewed-layers.ts',
      old: `      async ({ signal }) => {
        const { paths }`,
      new: `      async ({ signal }) => {
        this.events.inventoryChanged();
        const { paths }`,
    },
  ],
} satisfies Probe;
