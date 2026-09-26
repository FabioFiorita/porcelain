import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'a files rule reaches safeParse through Reflect.get, a parse under another name',
  gate: 'lint',
  rule: 'porcelain(no-schema-parse-aliases)',
  edits: [
    {
      kind: 'append',
      path: 'packages/files/src/rules/encode-base64.ts',
      content:
        '\nexport function probeParser(value: object): unknown {\n  return Reflect.get(value, "safeParse");\n}\n',
    },
  ],
} satisfies Probe;
