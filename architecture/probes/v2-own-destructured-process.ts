import type { Probe } from '../probe.ts';

export default {
  decision: 'V2',
  plants:
    "bootstrap/compose-server.ts: const { env } = process; debug: env.PORCELAIN_DEBUG === '1'",
  gate: 'lint',
  rule: 'porcelain(bootstrap-starts-nothing)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/bootstrap/compose-server.ts',
      old: '  const { limits } = settings;',
      new: `  const { limits } = settings;
  const { env } = process;`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/bootstrap/compose-server.ts',
      old: `  const useCases = { access, projects, files, changes, reviews, gitActions };
  return {
    jobs,`,
      new: `  const useCases = { access, projects, files, changes, reviews, gitActions };
  return {
    jobs,
    debug: env.PORCELAIN_DEBUG === '1',`,
    },
  ],
} satisfies Probe;
