import type { Probe } from '../probe.ts';

export default {
  decision: 'CI2',
  plants:
    'the runtime checkpoint made automatic in its workflow and sanctioned copy',
  gate: 'lint',
  rule: 'style(manual-audits)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/web.yml',
      old: '  workflow_dispatch:\n',
      new: '  pull_request:\n',
    },
    {
      kind: 'replace',
      path: 'architecture/sanctioned/ci.json',
      old: '"name": "Runtime checkpoint",\n      "on": {\n        "workflow_dispatch": null',
      new: '"name": "Runtime checkpoint",\n      "on": {\n        "pull_request": null',
    },
  ],
} satisfies Probe;
