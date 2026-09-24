import type { Probe } from '../probe.ts';

export default {
  decision: 'X4',
  plants:
    'models/probe/probe-model.ts exporting a function and ProbeResult = ProjectKey | undefined',
  gate: 'lint',
  rule: 'porcelain(models-are-types)',
  edits: [
    {
      kind: 'create',
      path: 'packages/projects/src/models/probe/probe-model.ts',
      content: `import type { ProjectKey } from '../project.ts';

export type ProbeResult = ProjectKey | undefined;

export function probeKey(projectId: string): ProjectKey {
  return { projectId };
}
`,
    },
  ],
} satisfies Probe;
