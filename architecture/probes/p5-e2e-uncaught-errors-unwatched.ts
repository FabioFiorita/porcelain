import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the e2e failures fixture stops listening for uncaught page errors, so an exception thrown in the page passes unnoticed',
  gate: 'web-verify',
  feature: 'apps/web/spec/e2e/protections.e2e.ts',
  rule: 'Error: expect(received).toEqual(expected)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/spec/e2e/fixtures.ts',
      old: "    context.on('weberror', (failure) =>\n",
      new: "    context.off('weberror', (failure) =>\n",
    },
  ],
} satisfies Probe;
