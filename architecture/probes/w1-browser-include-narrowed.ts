import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants:
    'the browser vitest config includes one spec, so the other cases never run',
  gate: 'lint',
  rule: 'style(vitest-config)',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/web-verify/scripts/vitest.browser.config.ts',
      old: "include: ['spec/browser/*.browser.ts'],",
      new: "include: ['spec/browser/app-shell.browser.ts'],",
    },
  ],
} satisfies Probe;
