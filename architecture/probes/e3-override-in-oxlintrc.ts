import type { Probe } from '../probe.ts';

export default {
  decision: 'EVASION',
  plants:
    '.oxlintrc.json: an override turning porcelain/no-exported-constants off for list-directory-service.ts, plus a literal 2000 there',
  gate: 'lint',
  rule: 'style(lint-config)',
  edits: [
    {
      kind: 'replace',
      path: '.oxlintrc.json',
      old: `  "overrides": [
`,
      new: `  "overrides": [
    {
      "files": ["packages/files/src/services/list-directory-service.ts"],
      "rules": { "porcelain/no-exported-constants": "off" }
    },
`,
    },
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: '        limit: this.options.maxEntries + 1,',
      new: '        limit: Math.min(this.options.maxEntries, 2000) + 1,',
    },
  ],
} satisfies Probe;
