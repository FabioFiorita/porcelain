import type { Probe } from '../probe.ts';

export default {
  decision: 'G2',
  plants:
    'the status policy spec importing the storage public API, which only storage and server adapter specs may',
  gate: 'lint',
  rule: 'porcelain(spec-imports)',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/http/status-policy.spec.ts',
      content: `import { openStorageSession } from '@porcelain/storage';
`,
    },
    {
      kind: 'append',
      path: 'apps/server/src/http/status-policy.spec.ts',
      content: `
describe('probe', () => {
  it('opens storage', () => {
    expect(openStorageSession).toBeTypeOf('function');
  });
});
`,
    },
  ],
} satisfies Probe;
