import type { Probe } from '../probe.ts';

const pasted = (name: string) =>
  `export function ${name}(paths: readonly string[], query: string) {\n  const needle = query.trim().toLowerCase();\n  const found = paths.filter((path) => path.toLowerCase().includes(needle));\n  const ranked = found.toSorted((left, right) => left.length - right.length);\n  const shown = ranked.slice(0, 20).map((path) => ({ path, name: path.split('/').at(-1) ?? path }));\n  return { needle, shown, more: ranked.length > shown.length };\n}\n`;

export default {
  decision: 'WG5',
  plants:
    'a file rule pasted twice under two names instead of extracted into one owner',
  gate: 'web-lint',
  rule: 'style(duplicate-code)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/files/rules/probe-copy.ts',
      content: `${pasted('matchPaths')}\n${pasted('findPaths')}`,
    },
  ],
} satisfies Probe;
