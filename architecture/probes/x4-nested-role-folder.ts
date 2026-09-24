import type { Probe } from '../probe.ts';

export default {
  decision: 'X4',
  plants: 'a subfolder inside models/ that classify used to accept',
  gate: 'arch',
  rule: 'role-folder-is-flat:',
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
