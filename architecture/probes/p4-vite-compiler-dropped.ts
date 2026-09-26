import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'the React Compiler removed from the web build',
  gate: 'web-lint',
  rule: 'style(vite-config)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/vite.config.ts',
      old: "    babel({ presets: [reactCompilerPreset({ panicThreshold: 'none' })] }),\n",
      new: '',
    },
  ],
} satisfies Probe;
