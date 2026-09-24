import type { Probe } from '../probe.ts';

export default {
  decision: 'P19',
  plants:
    'a probe claiming a service that writes outside its lane, with rule "error", that plants an empty class',
  gate: 'lint',
  rule: 'style(probe-shape)',
  edits: [
    {
      kind: 'create',
      path: 'architecture/probes/z9-service-writes-outside-lane.ts',
      content:
        "import type { Probe } from '../probe.ts';\n\nexport default {\n  decision: 'Z9',\n  plants: 'a service that writes outside its lane',\n  gate: 'lint',\n  rule: 'error',\n  edits: [\n    {\n      kind: 'create',\n      path: 'packages/projects/src/services/probe-empty-service.ts',\n      content: 'export class ProbeEmptyService {}\\n',\n    },\n  ],\n} satisfies Probe;\n",
    },
  ],
} satisfies Probe;
