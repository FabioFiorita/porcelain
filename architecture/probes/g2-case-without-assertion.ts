import type { Probe } from '../probe.ts';

export default {
  decision: 'G2',
  plants: 'a derive-project-name case that calls the rule and asserts nothing',
  gate: 'test',
  rule: 'expected any number of assertion, but got none',
  edits: [
    {
      kind: 'append',
      path: 'packages/projects/src/rules/derive-project-name.spec.ts',
      content: `
describe('deriveProjectName probe', () => {
  it('names a project after its folder', () => {
    deriveProjectName(undefined, '/srv/app');
  });
});
`,
    },
  ],
} satisfies Probe;
