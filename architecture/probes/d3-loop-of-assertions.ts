import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a files rule spec asserts inside a for loop instead of it.each',
  gate: 'lint',
  rule: 'porcelain(spec-one-case-per-behaviour)',
  edits: [
    {
      kind: 'append',
      path: 'packages/files/src/rules/encode-base64.spec.ts',
      content:
        '\ndescribe("encodeBase64 probe", () => {\n  it("encodes every size", () => {\n    for (const size of [1, 2])\n      expect(encodeBase64(new Uint8Array(size), 1)).not.toBe("");\n  });\n});\n',
    },
  ],
} satisfies Probe;
