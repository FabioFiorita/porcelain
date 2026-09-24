import type { Probe } from '../probe.ts';

export default {
  decision: 'V2',
  plants:
    "bootstrap/compose-server.ts: debug: process.env.PORCELAIN_DEBUG === '1' in the returned server",
  gate: 'lint',
  rule: 'porcelain(bootstrap-starts-nothing)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/bootstrap/compose-server.ts',
      old: `  const useCases = { access, projects, files, changes, reviews, gitActions };
  return {
    jobs,`,
      new: `  const useCases = { access, projects, files, changes, reviews, gitActions };
  return {
    jobs,
    debug: process.env.PORCELAIN_DEBUG === '1',`,
    },
  ],
} satisfies Probe;
