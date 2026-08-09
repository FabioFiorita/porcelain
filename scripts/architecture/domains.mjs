export const DOMAIN_KEYS = [
  'projects',
  'files',
  'git',
  'search',
  'review',
  'board',
  'actions',
  'terminal',
  'project-data',
  'remote',
]

export const DOMAIN_MIGRATIONS = Object.freeze(
  Object.fromEntries(
    DOMAIN_KEYS.map((key) => [
      key,
      Object.freeze({
        status: 'legacy',
        targetRoots: Object.freeze([]),
        legacyPaths: Object.freeze([]),
      }),
    ]),
  ),
)

export const DOMAIN_STATUS = Object.freeze(
  Object.fromEntries(DOMAIN_KEYS.map((key) => [key, DOMAIN_MIGRATIONS[key].status])),
)

export const SUPPORTING_REGIONS = [
  'shell',
  'viewer',
  'settings',
  'ui',
  'daemon-composition',
  'desktop',
  'native',
  'infrastructure',
]

export const LEGACY_FEATURE_DIRECTORIES = Object.freeze({
  'apps/mobile/src/features': ['changes', 'comments', 'diff', 'history', 'settings', 'shell'],
  'apps/web/src/features': [],
})

export const TARGET_DOMAIN_ROOTS = [
  'packages/contracts/src',
  'apps/daemon/src/features',
  'packages/client-runtime/src',
  'apps/web/src/features',
  'apps/mobile/src/features',
]

export const ARCHITECTURE_LINE_CEILING = 450

// Existing authored production files above the target ceiling. Caps may shrink; entries may only
// be removed. Test fixtures and generated UI primitives are intentionally outside this ledger.
export const OVERSIZED_PRODUCTION_FILES = Object.freeze({
  'apps/cli/src/cli.ts': 676,
  'apps/cli/src/evidence-file.ts': 543,
  'apps/daemon/src/git/commit-generation.ts': 991,
  'apps/daemon/src/git/git.ts': 947,
  'apps/desktop/src/main/shell-api.ts': 741,
  'apps/mobile/src/lib/daemon/environments-store.ts': 453,
  'apps/web/src/components/git/changes-list.tsx': 485,
  'apps/web/src/components/git/feature-view.tsx': 520,
  'apps/web/src/components/git/reading-surface.tsx': 904,
  'apps/web/src/lib/daemon.ts': 570,
  'apps/web/src/lib/terminal-registry.ts': 602,
  'apps/web/src/terminal/ghostty/core.ts': 1240,
  'apps/web/src/terminal/ghostty/surface.ts': 1778,
})

export const WEB_SERVER_IMPORT_BASELINE = Object.freeze({
  occurrences: 118,
  files: 96,
})

export const LEGACY_FOUNDATION_APP_IMPORTS = new Set([
  'packages/contracts/src/router.ts:@backend/api',
])
