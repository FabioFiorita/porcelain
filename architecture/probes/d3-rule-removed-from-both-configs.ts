import type { Probe } from '../probe.ts';

export default {
  decision: 'P24',
  plants:
    'typescript/no-explicit-any removed from .oxlintrc.json and architecture/lint-config.json alike, and a rule returning any',
  gate: 'lint',
  rule: 'style(rule-list)',
  edits: [
    {
      kind: 'replace',
      path: '.oxlintrc.json',
      old: '    "typescript/no-explicit-any": "error",\n',
      new: '',
    },
    {
      kind: 'replace',
      path: 'architecture/lint-config.json',
      old: '    "typescript/no-explicit-any": "error",\n',
      new: '',
    },
    {
      kind: 'create',
      path: 'packages/projects/src/rules/probe-widen.ts',
      content:
        'export function probeWiden(value: unknown): any {\n  return value;\n}\n',
    },
  ],
} satisfies Probe;
