import type { Probe } from '../probe.ts';

export default {
  decision: 'CI2',
  plants:
    'the typecheck task loses its transit dependency, so a cached package typecheck survives a change in a package it imports',
  gate: 'lint',
  rule: 'style(turbo-config)',
  edits: [
    {
      kind: 'replace',
      path: 'turbo.json',
      old: '    "typecheck": {\n      "dependsOn": ["transit"],\n',
      new: '    "typecheck": {\n',
    },
  ],
} satisfies Probe;
