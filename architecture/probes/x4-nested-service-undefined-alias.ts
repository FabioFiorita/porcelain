import type { Probe } from '../probe.ts';

export default {
  decision: 'X4',
  plants:
    'services/probe/probe-found-service.ts whose execute answers an alias of ProjectKey | undefined',
  gate: 'arch',
  rule: 'no-undefined-union-result:',
  edits: [
    {
      kind: 'create',
      path: 'packages/projects/src/services/probe/probe-found-service.ts',
      content: `import type { ProjectKey } from '../../models/project.ts';

type Found = ProjectKey | undefined;

export class ProbeFoundService {
  execute(input: ProjectKey): Found {
    return input.projectId === '' ? undefined : input;
  }
}
`,
    },
  ],
} satisfies Probe;
