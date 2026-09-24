import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a files rule spec adds a describe.skip block',
  gate: 'lint',
  rule: 'porcelain(spec-no-skips)',
  edits: [
    {
      kind: 'append',
      path: 'packages/files/src/rules/encode-base64.spec.ts',
      content:
        '\ndescribe.skip("encodeBase64 probe", () => {\n  it("encodes nothing as an empty string", () => {\n    expect(encodeBase64(new Uint8Array(), 1)).toBe("");\n  });\n});\n',
    },
  ],
} satisfies Probe;
