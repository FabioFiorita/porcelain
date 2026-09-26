import type { Probe } from '../probe.ts';

export default {
  decision: 'C6',
  plants:
    'kernel/rules/index.ts: import then `export { utf8ByteLength }` (a non-export statement in an index)',
  gate: 'lint',
  rule: 'porcelain(imports-by-path)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/kernel/src/rules/index.ts',
      old: "export { utf8ByteLength } from './utf8-byte-length.ts';",
      new: `import { utf8ByteLength } from './utf8-byte-length.ts';
export { utf8ByteLength };`,
    },
  ],
} satisfies Probe;
