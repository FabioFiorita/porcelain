import type { Probe } from '../probe.ts';

export default {
  decision: 'X5',
  plants:
    'apps/desktop/ARCHITECTURE.md narrating how the host process, the protocol and the server fit together',
  gate: 'lint',
  rule: 'style(prose-outside-skills)',
  edits: [
    {
      kind: 'create',
      path: 'apps/desktop/ARCHITECTURE.md',
      content:
        '# Desktop architecture\n\nThe main process proxies the web and the API to the local server and injects its credential.\n',
    },
  ],
} satisfies Probe;
