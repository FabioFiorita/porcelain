#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { DOMAIN_KEYS } from './architecture/domains.mjs'
import { checkArchitecture } from './lint-architecture.mjs'

// Messages only the ARC-002 registry/target-domain checks can produce. Fixture repos otherwise
// still trip the pre-existing legacy-ledger checks (oversized files, foundation imports) because
// those hardcoded paths do not exist under a temporary root; filtering to this pattern lets a
// fixture assert on the behavior under test without reproducing the whole legacy ledger.
const NEW_CHECK_PATTERN =
  /DOMAIN_MIGRATIONS must define|supporting region is also registered|registered target root|migration record|migration status|targetRoots must be an array|legacyPaths must be an array|invalid repository-relative POSIX path|contains a duplicate path|registers a target root|registers no target root|legacy path still exists|not unique across DOMAIN_MIGRATIONS|is not a registered target domain|has no public index\.ts|deep-imports|External deep imports|TARGET_ROOT_DEEP_IMPORT|direct child|claims the canonical/

function buildMigrations(overrides = {}) {
  const base = Object.fromEntries(
    DOMAIN_KEYS.map((key) => [key, { status: 'legacy', targetRoots: [], legacyPaths: [] }]),
  )
  for (const [key, patch] of Object.entries(overrides)) base[key] = { ...base[key], ...patch }
  return base
}

function writeFixtureFile(root, relativePath, content) {
  const absolute = path.join(root, relativePath)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

function withFixtureRepo(build, run) {
  const root = mkdtempSync(path.join(tmpdir(), 'lint-architecture-'))
  try {
    build(root)
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function newViolations(failures) {
  return failures.filter((failure) => NEW_CHECK_PATTERN.test(failure))
}

test('a canonical-named legacy directory remains allowed until it exposes a public index.ts', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/mobile/src/features/tasks/tasks-column.tsx',
        'export const x = 1\n',
      )
    },
    (root) => {
      const failures = checkArchitecture(root, buildMigrations())
      assert.deepEqual(newViolations(failures), [])
    },
  )
})

test('an unregistered target domain directory fails once it exposes a public index.ts', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(root, 'apps/daemon/src/features/tasks/index.ts', 'export const tasks = 1\n')
    },
    (root) => {
      const failures = checkArchitecture(root, buildMigrations())
      assert.ok(
        failures.some((failure) =>
          /index\.ts exists but is not a registered target root for domain tasks/.test(failure),
        ),
      )
    },
  )
})

test('a registered migrating root with its public index.ts passes', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(root, 'apps/daemon/src/features/tasks/index.ts', 'export const tasks = 1\n')
    },
    (root) => {
      const migrations = buildMigrations({
        tasks: {
          status: 'migrating',
          targetRoots: ['apps/daemon/src/features/tasks'],
          legacyPaths: [],
        },
      })
      const failures = checkArchitecture(root, migrations)
      assert.deepEqual(newViolations(failures), [])
    },
  )
})

test('an explicitly registered alias root is owned by its domain and allowed in the feature tree', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/mobile/src/features/comments/index.ts',
        'export const comments = 1\n',
      )
    },
    (root) => {
      const migrations = buildMigrations({
        review: {
          status: 'migrating',
          targetRoots: ['apps/mobile/src/features/comments'],
          legacyPaths: [],
        },
      })
      // Empty deep-import baselines: this fixture is about registration, not presentation debt.
      const failures = checkArchitecture(root, migrations, {})
      assert.deepEqual(newViolations(failures), [])
      assert.ok(
        !failures.some((failure) => failure.includes('comments is neither a canonical domain')),
      )
    },
  )
})

test('an alias root cannot claim another canonical domain name', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(root, 'apps/mobile/src/features/tasks/index.ts', 'export const tasks = 1\n')
    },
    (root) => {
      const migrations = buildMigrations({
        review: {
          status: 'migrating',
          targetRoots: ['apps/mobile/src/features/tasks'],
          legacyPaths: [],
        },
      })
      const failures = checkArchitecture(root, migrations)
      assert.ok(
        failures.some((failure) =>
          failure.includes(
            'review target root apps/mobile/src/features/tasks claims the canonical tasks domain name',
          ),
        ),
      )
    },
  )
})

test('a deep relative import across a foreign registered root fails', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/daemon/src/features/tasks/index.ts',
        "import { deep } from '../git/deep'\nexport const tasks = 1\n",
      )
      writeFixtureFile(root, 'apps/daemon/src/features/git/index.ts', 'export const git = 1\n')
      writeFixtureFile(root, 'apps/daemon/src/features/git/deep.ts', 'export const deep = 1\n')
    },
    (root) => {
      const migrations = buildMigrations({
        tasks: {
          status: 'migrating',
          targetRoots: ['apps/daemon/src/features/tasks'],
          legacyPaths: [],
        },
        git: {
          status: 'migrating',
          targetRoots: ['apps/daemon/src/features/git'],
          legacyPaths: [],
        },
      })
      const failures = checkArchitecture(root, migrations)
      assert.ok(failures.some((failure) => failure.includes('deep-imports')))
    },
  )
})

test('a relative import that resolves to the foreign root index.ts passes', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/daemon/src/features/tasks/index.ts',
        "import { git } from '../git'\nexport const tasks = 1\n",
      )
      writeFixtureFile(root, 'apps/daemon/src/features/git/index.ts', 'export const git = 1\n')
    },
    (root) => {
      const migrations = buildMigrations({
        tasks: {
          status: 'migrating',
          targetRoots: ['apps/daemon/src/features/tasks'],
          legacyPaths: [],
        },
        git: {
          status: 'migrating',
          targetRoots: ['apps/daemon/src/features/git'],
          legacyPaths: [],
        },
      })
      const failures = checkArchitecture(root, migrations)
      assert.ok(!failures.some((failure) => failure.includes('deep-imports')))
    },
  )
})

const aliasTargetRoots = [
  {
    targetRoot: 'apps/daemon/src/features',
    alias: '@backend/features/',
  },
  {
    targetRoot: 'apps/daemon/src/features',
    alias: '@porcelain/daemon/features/',
  },
  {
    targetRoot: 'apps/web/src/features',
    alias: '@renderer/features/',
  },
  {
    targetRoot: 'apps/mobile/src/features',
    alias: '@/features/',
  },
  {
    targetRoot: 'packages/contracts/src',
    alias: '@porcelain/contracts/',
  },
  {
    targetRoot: 'packages/client-runtime/src',
    alias: '@porcelain/client-runtime/',
  },
]

for (const { targetRoot, alias } of aliasTargetRoots) {
  test(`${alias} rejects a deep import but permits the foreign public index`, () => {
    withFixtureRepo(
      (root) => {
        writeFixtureFile(
          root,
          `${targetRoot}/tasks/index.ts`,
          `import { deep } from '${alias}git/deep'\nexport const tasks = deep\n`,
        )
        writeFixtureFile(root, `${targetRoot}/git/index.ts`, 'export const git = 1\n')
        writeFixtureFile(root, `${targetRoot}/git/deep.ts`, 'export const deep = 1\n')
      },
      (root) => {
        const migrations = buildMigrations({
          tasks: {
            status: 'migrating',
            targetRoots: [`${targetRoot}/tasks`],
            legacyPaths: [],
          },
          git: {
            status: 'migrating',
            targetRoots: [`${targetRoot}/git`],
            legacyPaths: [],
          },
        })
        const deepFailures = checkArchitecture(root, migrations)
        assert.ok(deepFailures.some((failure) => failure.includes('deep-imports')))

        writeFixtureFile(
          root,
          `${targetRoot}/tasks/index.ts`,
          `import { git } from '${alias}git'\nexport const tasks = git\n`,
        )
        const publicEntryFailures = checkArchitecture(root, migrations)
        assert.ok(!publicEntryFailures.some((failure) => failure.includes('deep-imports')))
      },
    )
  })
}

test('malformed migration records and path lists fail without crashing', () => {
  withFixtureRepo(
    () => {},
    (root) => {
      const migrations = buildMigrations()
      migrations.tasks = null
      migrations.git = {
        status: 'migrating',
        targetRoots: 'apps/daemon/src/features/git',
        legacyPaths: [],
      }
      migrations.search = {
        status: 'legacy',
        targetRoots: [],
        legacyPaths: 'apps/daemon/src/search',
      }

      const failures = checkArchitecture(root, migrations)
      assert.ok(
        failures.some((failure) =>
          failure.includes('domain tasks migration record must be an object'),
        ),
      )
      assert.ok(
        failures.some((failure) => failure.includes('domain git targetRoots must be an array')),
      )
      assert.ok(
        failures.some((failure) => failure.includes('domain search legacyPaths must be an array')),
      )
    },
  )
})

test('migration paths must be unique normalized repository-relative POSIX strings', () => {
  withFixtureRepo(
    () => {},
    (root) => {
      const migrations = buildMigrations({
        tasks: {
          status: 'legacy',
          targetRoots: [],
          legacyPaths: [
            '',
            '/absolute',
            'C:/windows-absolute',
            '../outside-root',
            'apps\\daemon',
            'apps//daemon',
            'apps/./daemon',
            'apps/daemon/../search',
            42,
            'duplicate',
            'duplicate',
          ],
        },
      })

      const failures = checkArchitecture(root, migrations)
      assert.equal(
        failures.filter((failure) => failure.includes('invalid repository-relative POSIX path'))
          .length,
        9,
      )
      assert.ok(
        failures.some((failure) =>
          failure.includes('legacyPaths contains a duplicate path: duplicate'),
        ),
      )
    },
  )
})

test('a foundation package importing an application fails unconditionally', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'packages/contracts/src/router.ts',
        "import type { AppRouter } from '@backend/api'\nexport type Router = AppRouter\n",
      )
    },
    (root) => {
      const failures = checkArchitecture(root, buildMigrations())
      assert.ok(
        failures.some((failure) =>
          /packages\/contracts\/src\/router\.ts crosses from a foundation package into an application: @backend\/api/.test(
            failure,
          ),
        ),
      )
    },
  )
})

test('a complete domain fails while its recorded legacy path still exists', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/daemon/src/features/search/index.ts',
        'export const search = 1\n',
      )
      writeFixtureFile(root, 'apps/daemon/src/legacy-search.ts', 'export const legacySearch = 1\n')
    },
    (root) => {
      const migrations = buildMigrations({
        search: {
          status: 'complete',
          targetRoots: ['apps/daemon/src/features/search'],
          legacyPaths: ['apps/daemon/src/legacy-search.ts'],
        },
      })
      const failures = checkArchitecture(root, migrations)
      assert.ok(
        failures.some((failure) =>
          /domain search is complete but its legacy path still exists/.test(failure),
        ),
      )
    },
  )
})

test('a registered Tasks root deep-importing a foreign Review-owned comments alias fails immediately', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/mobile/src/features/tasks/index.ts',
        "import { deep } from '@/features/comments/comment-composer'\nexport const tasks = deep\n",
      )
      writeFixtureFile(
        root,
        'apps/mobile/src/features/comments/index.ts',
        'export const comments = 1\n',
      )
      writeFixtureFile(
        root,
        'apps/mobile/src/features/comments/comment-composer.tsx',
        'export const deep = 1\n',
      )
    },
    (root) => {
      const migrations = buildMigrations({
        tasks: {
          status: 'migrating',
          targetRoots: ['apps/mobile/src/features/tasks'],
          legacyPaths: [],
        },
        review: {
          status: 'migrating',
          targetRoots: ['apps/mobile/src/features/comments'],
          legacyPaths: [],
        },
      })
      // Baseline would cover external (non-registered) importers only; cross-root stays hard-fail.
      const failures = checkArchitecture(root, migrations, {
        'apps/mobile/src/features/comments': { occurrences: 99, files: 99 },
      })
      assert.ok(
        failures.some(
          (failure) =>
            failure.includes('deep-imports') &&
            failure.includes('apps/mobile/src/features/comments/comment-composer.tsx') &&
            failure.includes('apps/mobile/src/features/comments'),
        ),
      )
    },
  )
})

test('external deep imports into a registered alias are accounted against a shrink-only baseline', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/mobile/src/features/comments/index.ts',
        'export const comments = 1\n',
      )
      writeFixtureFile(
        root,
        'apps/mobile/src/features/comments/comment-composer.tsx',
        'export const Composer = 1\n',
      )
      writeFixtureFile(
        root,
        'apps/mobile/src/features/diff/diff-view.tsx',
        "import { Composer } from '@/features/comments/comment-composer'\nexport const Diff = Composer\n",
      )
    },
    (root) => {
      const migrations = buildMigrations({
        review: {
          status: 'migrating',
          targetRoots: ['apps/mobile/src/features/comments'],
          legacyPaths: [],
        },
      })

      const within = checkArchitecture(root, migrations, {
        'apps/mobile/src/features/comments': { occurrences: 1, files: 1 },
      })
      assert.ok(!within.some((failure) => /External deep imports|deep-imports/.test(failure)))

      const growth = checkArchitecture(root, migrations, {
        'apps/mobile/src/features/comments': { occurrences: 0, files: 0 },
      })
      assert.ok(
        growth.some((failure) =>
          failure.includes(
            'External deep imports into apps/mobile/src/features/comments grew from 0 to 1 occurrences',
          ),
        ),
      )

      // Shrinking below the recorded baseline remains allowed.
      const shrink = checkArchitecture(root, migrations, {
        'apps/mobile/src/features/comments': { occurrences: 5, files: 5 },
      })
      assert.ok(!shrink.some((failure) => failure.includes('External deep imports')))
    },
  )
})

test('external deep imports without a baseline fail immediately; zero baseline must be removed', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/mobile/src/features/comments/index.ts',
        'export const comments = 1\n',
      )
      writeFixtureFile(
        root,
        'apps/mobile/src/features/comments/comment-composer.tsx',
        'export const Composer = 1\n',
      )
      writeFixtureFile(
        root,
        'apps/mobile/src/features/diff/diff-view.tsx',
        "import { Composer } from '@/features/comments/comment-composer'\nexport const Diff = Composer\n",
      )
    },
    (root) => {
      const migrations = buildMigrations({
        review: {
          status: 'migrating',
          targetRoots: ['apps/mobile/src/features/comments'],
          legacyPaths: [],
        },
      })

      const noBaseline = checkArchitecture(root, migrations, {})
      assert.ok(
        noBaseline.some(
          (failure) =>
            failure.includes('deep-imports') &&
            failure.includes('apps/mobile/src/features/comments/comment-composer.tsx'),
        ),
      )
    },
  )

  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/mobile/src/features/comments/index.ts',
        'export const comments = 1\n',
      )
    },
    (root) => {
      const migrations = buildMigrations({
        review: {
          status: 'migrating',
          targetRoots: ['apps/mobile/src/features/comments'],
          legacyPaths: [],
        },
      })
      const failures = checkArchitecture(root, migrations, {
        'apps/mobile/src/features/comments': { occurrences: 1, files: 1 },
      })
      assert.ok(
        failures.some((failure) =>
          failure.includes(
            'External deep imports into apps/mobile/src/features/comments reached zero; remove its TARGET_ROOT_DEEP_IMPORT_BASELINES entry',
          ),
        ),
      )
    },
  )
})

test('null or non-object deep-import baseline catalogs fail without crashing', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/mobile/src/features/comments/index.ts',
        'export const comments = 1\n',
      )
      writeFixtureFile(
        root,
        'apps/mobile/src/features/comments/comment-composer.tsx',
        'export const Composer = 1\n',
      )
      writeFixtureFile(
        root,
        'apps/mobile/src/features/diff/diff-view.tsx',
        "import { Composer } from '@/features/comments/comment-composer'\nexport const Diff = Composer\n",
      )
    },
    (root) => {
      const migrations = buildMigrations({
        review: {
          status: 'migrating',
          targetRoots: ['apps/mobile/src/features/comments'],
          legacyPaths: [],
        },
      })

      for (const catalog of [null, [], 'nope', 42]) {
        const failures = checkArchitecture(root, migrations, /** @type {any} */ (catalog))
        assert.ok(
          failures.some((failure) =>
            failure.includes(
              'TARGET_ROOT_DEEP_IMPORT_BASELINES must be an object of root → { occurrences, files }',
            ),
          ),
          `expected catalog failure for ${String(catalog)}`,
        )
        // Scanning still reports the unbaselined deep import (empty catalog after normalize).
        assert.ok(
          failures.some(
            (failure) =>
              failure.includes('deep-imports') &&
              failure.includes('apps/mobile/src/features/comments/comment-composer.tsx'),
          ),
        )
      }
    },
  )
})

test('malformed deep-import baseline records fail without crashing', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/mobile/src/features/comments/index.ts',
        'export const comments = 1\n',
      )
      writeFixtureFile(
        root,
        'apps/mobile/src/features/comments/comment-composer.tsx',
        'export const Composer = 1\n',
      )
      writeFixtureFile(
        root,
        'apps/mobile/src/features/diff/diff-view.tsx',
        "import { Composer } from '@/features/comments/comment-composer'\nexport const Diff = Composer\n",
      )
    },
    (root) => {
      const migrations = buildMigrations({
        review: {
          status: 'migrating',
          targetRoots: ['apps/mobile/src/features/comments'],
          legacyPaths: [],
        },
      })
      const rootKey = 'apps/mobile/src/features/comments'

      const nullRecord = checkArchitecture(root, migrations, { [rootKey]: null })
      assert.ok(
        nullRecord.some((failure) =>
          failure.includes(
            `TARGET_ROOT_DEEP_IMPORT_BASELINES[${rootKey}] must be { occurrences: number, files: number }`,
          ),
        ),
      )

      const extraKey = checkArchitecture(root, migrations, {
        [rootKey]: { occurrences: 1, files: 1, extra: true },
      })
      assert.ok(
        extraKey.some((failure) =>
          failure.includes(
            `TARGET_ROOT_DEEP_IMPORT_BASELINES[${rootKey}] must have exactly occurrences and files`,
          ),
        ),
      )

      const missingKey = checkArchitecture(root, migrations, {
        [rootKey]: { occurrences: 1 },
      })
      assert.ok(
        missingKey.some((failure) =>
          failure.includes(
            `TARGET_ROOT_DEEP_IMPORT_BASELINES[${rootKey}] must have exactly occurrences and files`,
          ),
        ),
      )

      for (const bad of [
        { occurrences: 1.5, files: 1 },
        { occurrences: -1, files: 1 },
        { occurrences: Number.POSITIVE_INFINITY, files: 1 },
        { occurrences: Number.NaN, files: 1 },
        { occurrences: '1', files: 1 },
        { occurrences: 1, files: -0.1 },
      ]) {
        const failures = checkArchitecture(root, migrations, { [rootKey]: bad })
        assert.ok(
          failures.some((failure) =>
            failure.includes(
              `TARGET_ROOT_DEEP_IMPORT_BASELINES[${rootKey}] occurrences and files must be finite non-negative integers`,
            ),
          ),
          `expected integer validation for ${JSON.stringify(bad)}`,
        )
      }
    },
  )
})

test('production-mode rejects baseline roots that are no longer registered; fixture mode stays quiet', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/mobile/src/features/comments/index.ts',
        'export const comments = 1\n',
      )
    },
    (root) => {
      const migrations = buildMigrations({
        review: {
          status: 'migrating',
          targetRoots: ['apps/mobile/src/features/comments'],
          legacyPaths: [],
        },
      })
      const staleRoot = 'apps/mobile/src/features/tasks'
      const baselines = {
        'apps/mobile/src/features/comments': { occurrences: 1, files: 1 },
        [staleRoot]: { occurrences: 3, files: 2 },
      }

      // Fixture default: custom migration catalog → do not demand removal of unrelated roots.
      const fixtureQuiet = checkArchitecture(root, migrations, baselines)
      assert.ok(
        !fixtureQuiet.some((failure) => failure.includes(staleRoot)),
        'fixture mode must not report stale unregistered baseline roots',
      )
      // comments baseline is still enforced (zero actual → remove-at-zero).
      assert.ok(
        fixtureQuiet.some((failure) =>
          failure.includes(
            'External deep imports into apps/mobile/src/features/comments reached zero',
          ),
        ),
      )

      // Explicit production-mode option: unregistered baseline roots are stale and must go.
      const productionMode = checkArchitecture(root, migrations, baselines, {
        rejectUnregisteredBaselineRoots: true,
      })
      assert.ok(
        productionMode.some((failure) =>
          failure.includes(
            `TARGET_ROOT_DEEP_IMPORT_BASELINES names ${staleRoot} which is not a registered target root; remove the stale baseline entry`,
          ),
        ),
      )
    },
  )
})
