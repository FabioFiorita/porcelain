import type { Probe } from '../probe.ts';

export default {
  decision: 'G2',
  plants:
    'a derive-project-name case registered inside an if, so it never registers',
  gate: 'lint',
  rule: 'porcelain(spec-asserts)',
  edits: [
    {
      kind: 'append',
      path: 'packages/projects/src/rules/derive-project-name.spec.ts',
      content: `
const RUNS = [].length > 0;

describe('deriveProjectName probe', () => {
  if (RUNS)
    it('never registers', () => {
      expect(deriveProjectName(undefined, '/srv/app')).toBe('api');
    });
});
`,
    },
  ],
} satisfies Probe;
