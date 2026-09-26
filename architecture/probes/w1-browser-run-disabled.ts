import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants:
    'the browser vitest config turns Browser Mode off, so the web cases leave Chromium',
  gate: 'lint',
  rule: 'style(vitest-config)',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/web-verify/scripts/vitest.browser.config.ts',
      old: 'enabled: true,',
      new: 'enabled: false,',
    },
  ],
} satisfies Probe;
