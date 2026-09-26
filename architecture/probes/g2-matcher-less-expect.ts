import type { Probe } from '../probe.ts';

export default {
  decision: 'G2',
  plants: 'a derive-project-name case whose expect names no matcher',
  gate: 'lint',
  rule: 'porcelain(spec-asserts)',
  edits: [
    {
      kind: 'append',
      path: 'packages/projects/src/rules/derive-project-name.spec.ts',
      content: `
describe('deriveProjectName probe', () => {
  it('names a project after its folder', () => {
    expect(deriveProjectName(undefined, '/srv/app'));
  });
});
`,
    },
  ],
} satisfies Probe;
