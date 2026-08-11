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
  /DOMAIN_MIGRATIONS must define|supporting region is also registered|registered target root|migration record|migration status|targetRoots must be an array|legacyPaths must be an array|invalid repository-relative POSIX path|contains a duplicate path|registers a target root|registers no target root|legacy path still exists|not unique across DOMAIN_MIGRATIONS|is not a registered target domain|has no public index\.ts|deep-imports|direct child|claims the canonical/

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
        'apps/mobile/src/features/board/board-column.tsx',
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
      writeFixtureFile(root, 'apps/daemon/src/features/board/index.ts', 'export const board = 1\n')
    },
    (root) => {
      const failures = checkArchitecture(root, buildMigrations())
      assert.ok(
        failures.some((failure) =>
          /index\.ts exists but is not a registered target root for domain board/.test(failure),
        ),
      )
    },
  )
})

test('a registered migrating root with its public index.ts passes', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(root, 'apps/daemon/src/features/board/index.ts', 'export const board = 1\n')
    },
    (root) => {
      const migrations = buildMigrations({
        board: {
          status: 'migrating',
          targetRoots: ['apps/daemon/src/features/board'],
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
      const failures = checkArchitecture(root, migrations)
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
      writeFixtureFile(root, 'apps/mobile/src/features/board/index.ts', 'export const board = 1\n')
    },
    (root) => {
      const migrations = buildMigrations({
        review: {
          status: 'migrating',
          targetRoots: ['apps/mobile/src/features/board'],
          legacyPaths: [],
        },
      })
      const failures = checkArchitecture(root, migrations)
      assert.ok(
        failures.some((failure) =>
          failure.includes(
            'review target root apps/mobile/src/features/board claims the canonical board domain name',
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
        'apps/daemon/src/features/board/index.ts',
        "import { deep } from '../git/deep'\nexport const board = 1\n",
      )
      writeFixtureFile(root, 'apps/daemon/src/features/git/index.ts', 'export const git = 1\n')
      writeFixtureFile(root, 'apps/daemon/src/features/git/deep.ts', 'export const deep = 1\n')
    },
    (root) => {
      const migrations = buildMigrations({
        board: {
          status: 'migrating',
          targetRoots: ['apps/daemon/src/features/board'],
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
        'apps/daemon/src/features/board/index.ts',
        "import { git } from '../git'\nexport const board = 1\n",
      )
      writeFixtureFile(root, 'apps/daemon/src/features/git/index.ts', 'export const git = 1\n')
    },
    (root) => {
      const migrations = buildMigrations({
        board: {
          status: 'migrating',
          targetRoots: ['apps/daemon/src/features/board'],
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
          `${targetRoot}/board/index.ts`,
          `import { deep } from '${alias}git/deep'\nexport const board = deep\n`,
        )
        writeFixtureFile(root, `${targetRoot}/git/index.ts`, 'export const git = 1\n')
        writeFixtureFile(root, `${targetRoot}/git/deep.ts`, 'export const deep = 1\n')
      },
      (root) => {
        const migrations = buildMigrations({
          board: {
            status: 'migrating',
            targetRoots: [`${targetRoot}/board`],
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
          `${targetRoot}/board/index.ts`,
          `import { git } from '${alias}git'\nexport const board = git\n`,
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
      migrations.board = null
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
          failure.includes('domain board migration record must be an object'),
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
        board: {
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
