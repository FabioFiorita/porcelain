import type { Probe } from '../probe.ts';

export default {
  decision: 'G2',
  plants: 'a derive-project-name case asserting inside .map over its rows',
  gate: 'lint',
  rule: 'porcelain(spec-asserts)',
  edits: [
    {
      kind: 'append',
      path: 'packages/projects/src/rules/derive-project-name.spec.ts',
      content: `
describe('deriveProjectName probe', () => {
  it('names every project after its folder', () => {
    ['/srv/app', '/srv/api'].map((path) =>
      expect(deriveProjectName(undefined, path)).toBe(path.slice(5)),
    );
  });
});
`,
    },
  ],
} satisfies Probe;
