/** Fixed ids so URLs survive a reload. Shaped like the uuids the server issues. */

export const ENVIRONMENT_ID = '5d1c4b2a-0000-4000-8000-000000000001';

export const PROJECT_IDS = {
  porcelain: 'a1000000-0000-4000-8000-000000000001',
  fieldnotes: 'a1000000-0000-4000-8000-000000000002',
  atlas: 'a1000000-0000-4000-8000-000000000003',
} as const;

/** Real worktree ids are derived from the Git folder's filesystem identity; these stand in for them. */
export const WORKTREE_IDS = {
  porcelainRebuild: 'b1000000-0000-4000-8000-000000000001',
  porcelainEmptyMatch: 'b1000000-0000-4000-8000-000000000002',
  porcelainMain: 'b1000000-0000-4000-8000-000000000003',
  fieldnotesFilters: 'b1000000-0000-4000-8000-000000000004',
  fieldnotesMain: 'b1000000-0000-4000-8000-000000000005',
  porcelainTreeIcons: 'b1000000-0000-4000-8000-000000000006',
} as const;
