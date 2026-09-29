import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'changes.branch-base',
  route: '/',
  reach: 'Review → Changes → Branch → Against … → branch',
  behaviour:
    'Choosing another base branch compares the branch against it, keeps the choice in the address, and choosing the default branch again returns to the default comparison.',
  server: ['changes.read-branch-changes'],
  spec: 'apps/web/spec/browser/changes-branch-base.browser.ts',
} satisfies JourneyEntry;
