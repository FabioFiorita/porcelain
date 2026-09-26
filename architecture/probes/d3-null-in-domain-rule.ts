import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a files rule returns null for absence',
  gate: 'lint',
  rule: 'porcelain(no-null-in-domain)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/rules/encode-base64.ts',
      old: '  return btoa(binary);',
      new: '  return binary === "" ? String(null) : btoa(binary);',
    },
  ],
} satisfies Probe;
