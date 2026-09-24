import type { Probe } from '../probe.ts';

export default {
  decision: 'C6',
  plants:
    'files/rules/index.ts: import then `export { encodeBase64 }` (a non-export statement in an index)',
  gate: 'lint',
  rule: 'porcelain(imports-by-path)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/rules/index.ts',
      old: "export { encodeBase64 } from './encode-base64.ts';",
      new: `import { encodeBase64 } from './encode-base64.ts';
export { encodeBase64 };`,
    },
  ],
} satisfies Probe;
