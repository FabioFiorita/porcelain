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
    DOMAIN_KEYS.map((key) => {
      const targetRoots = [`packages/contracts/src/${key}`]
      // Board is the primary exemplar: contracts (BRD-001), daemon (BRD-002), client-runtime (BRD-003).
      if (key === 'board') {
        targetRoots.push('apps/daemon/src/features/board')
        targetRoots.push('packages/client-runtime/src/board')
        targetRoots.push('apps/web/src/features/board')
        targetRoots.push('apps/mobile/src/features/board')
      }
      if (key === 'actions') {
        targetRoots.push('apps/daemon/src/features/actions')
        targetRoots.push('packages/client-runtime/src/actions')
        targetRoots.push('apps/web/src/features/actions')
        targetRoots.push('apps/mobile/src/features/actions')
      }
      if (key === 'projects') {
        targetRoots.push('apps/daemon/src/features/projects')
        targetRoots.push('packages/client-runtime/src/projects')
        targetRoots.push('apps/web/src/features/projects')
        targetRoots.push('apps/mobile/src/features/projects')
      }
      // Review comments: contracts + daemon (RVC-001), client-runtime (RVC-002), Web (RVC-003),
      // mobile (RVC-004).
      if (key === 'review') {
        targetRoots.push('apps/daemon/src/features/review')
        targetRoots.push('packages/client-runtime/src/review')
        targetRoots.push('apps/web/src/features/review')
        targetRoots.push('apps/mobile/src/features/comments')
      }
      if (key === 'files') {
        targetRoots.push('apps/daemon/src/features/files')
        targetRoots.push('packages/client-runtime/src/files')
        targetRoots.push('apps/web/src/features/files')
        targetRoots.push('apps/mobile/src/features/files')
      }
      if (key === 'search') {
        targetRoots.push('apps/daemon/src/features/search')
        targetRoots.push('packages/client-runtime/src/search')
        targetRoots.push('apps/web/src/features/search')
        targetRoots.push('apps/mobile/src/features/search')
      }
      if (key === 'git') {
        targetRoots.push('apps/daemon/src/features/git')
        targetRoots.push('packages/client-runtime/src/git')
        targetRoots.push('apps/web/src/features/git')
        targetRoots.push('apps/mobile/src/features/git')
      }
      if (key === 'terminal') {
        targetRoots.push('apps/daemon/src/features/terminal')
        targetRoots.push('packages/client-runtime/src/terminal')
        targetRoots.push('apps/web/src/features/terminal')
        targetRoots.push('apps/mobile/src/features/terminal')
      }
      if (key === 'remote') {
        targetRoots.push('apps/daemon/src/features/remote')
        targetRoots.push('packages/client-runtime/src/remote')
        targetRoots.push('apps/web/src/features/remote')
        targetRoots.push('apps/mobile/src/features/remote')
      }
      return [
        key,
        Object.freeze({
          status:
            key === 'search' || key === 'actions' || key === 'terminal' || key === 'remote'
              ? 'complete'
              : 'migrating',
          targetRoots: Object.freeze(targetRoots),
          legacyPaths: Object.freeze([]),
        }),
      ]
    }),
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
  'apps/mobile/src/features': ['changes', 'diff', 'history', 'settings', 'shell'],
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
  'apps/web/src/components/git/changes-list.tsx': 468,
  'apps/web/src/components/git/feature-view.tsx': 520,
  'apps/web/src/components/git/reading-surface.tsx': 904,
  'apps/web/src/lib/terminal-registry.ts': 602,
  'apps/web/src/terminal/ghostty/core.ts': 1240,
  'apps/web/src/terminal/ghostty/surface.ts': 1778,
})

export const WEB_SERVER_IMPORT_BASELINE = Object.freeze({
  occurrences: 106,
  files: 86,
})

/**
 * Shrink-only baselines for external production deep imports into a registered target root
 * (importers outside that root resolving to non-`index.ts` internals). Counts are real
 * resolved production imports only — not comments/tests. Occurrences and files may shrink
 * or stay; growth fails. When both reach zero the baseline entry must be removed.
 *
 * Cross-imports between two registered target roots remain an immediate rejection and are
 * never absorbed by these baselines.
 *
 * `apps/mobile/src/features/comments` is the RVC-004 presentation-module migration debt
 * (composer/line-range/selection remain deep-imported until a later unit rehomes them).
 * Other entries inventory pre-existing external deep imports so the gate can stay strict
 * without inventing a special waiver path.
 */
export const TARGET_ROOT_DEEP_IMPORT_BASELINES = Object.freeze({
  'apps/mobile/src/features/comments': Object.freeze({
    occurrences: 28,
    files: 16,
  }),
  'apps/web/src/features/review': Object.freeze({
    occurrences: 14,
    files: 14,
  }),
  'packages/contracts/src/board': Object.freeze({
    occurrences: 3,
    files: 3,
  }),
  'packages/contracts/src/review': Object.freeze({
    occurrences: 2,
    files: 2,
  }),
})
