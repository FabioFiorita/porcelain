#!/usr/bin/env node
/**
 * Self-tests for lint-cli-boundary.mjs. Each violation has a controlled fixture;
 * one valid fixture proves the gate accepts a correct tree.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { checkCliBoundary } from './lint-cli-boundary.mjs'

function writeFixtureFile(root, relativePath, content) {
  const absolute = path.join(root, relativePath)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

function withFixtureRepo(build, run) {
  const root = mkdtempSync(path.join(tmpdir(), 'lint-cli-boundary-'))
  try {
    build(root)
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

/** Minimal tree that satisfies every CLI-001 invariant. */
function writeValidCliTree(root, overrides = {}) {
  const packageJson =
    overrides.packageJson ??
    JSON.stringify(
      {
        name: '@porcelain/cli',
        private: true,
        dependencies: { '@porcelain/shared': 'workspace:*' },
        devDependencies: { typescript: '^5.0.0' },
      },
      null,
      2,
    )

  const projectIo =
    overrides.projectIo ??
    `import { renameSync, writeFileSync } from 'node:fs'

export function writeProjectJson(repoPath, fileName, value) {
  const path = \`\${repoPath}/\${fileName}\`
  const tmp = \`\${path}.tmp\`
  writeFileSync(tmp, JSON.stringify(value, null, 2))
  renameSync(tmp, path)
}
`

  const cliTs =
    overrides.cliTs ??
    `import { readFileSync } from 'node:fs'
import { helper } from './helper'
import { PROJECT_FILES } from '@shared/project-porcelain'

export const COMMANDS = [
  { noun: 'board', verbs: [{ verb: 'list', args: '', desc: 'List cards' }] },
]

export function runCli() {
  return helper() + PROJECT_FILES.board + readFileSync(0, 'utf8')
}
`

  const helperTs = overrides.helperTs ?? `export function helper() { return 'ok' }\n`

  const buildNode =
    overrides.buildNode ??
    `import { join } from 'node:path'
const common = { bundle: true, platform: 'node' }
async function buildDaemon() {
  await esbuild.build({ ...common, external: ['ws'] })
}
async function buildProtocol() {
  await esbuild.build({ ...common, external: ['zod'] })
}
async function buildCli() {
  const outfile = join(outMain, 'cli', 'porcelain.js')
  await esbuild.build({
    ...common,
    entryPoints: [join(root, 'apps', 'cli', 'src', 'porcelain.ts')],
    outfile,
    packages: 'bundle',
  })
}
`

  writeFixtureFile(root, 'apps/cli/package.json', packageJson)
  writeFixtureFile(root, 'apps/cli/src/project-io.ts', projectIo)
  writeFixtureFile(root, 'apps/cli/src/cli.ts', cliTs)
  writeFixtureFile(root, 'apps/cli/src/helper.ts', helperTs)
  writeFixtureFile(
    root,
    'apps/cli/src/cli.test.ts',
    `// test files are excluded from the production scan
import { createServer } from 'node:http'
import { something } from '@porcelain/contracts'
export const ignore = createServer
`,
  )
  writeFixtureFile(root, 'scripts/build-node.mjs', buildNode)
}

test('a valid CLI tree passes with no violations', () => {
  withFixtureRepo(
    (root) => {
      writeValidCliTree(root)
    },
    (root) => {
      assert.deepEqual(checkCliBoundary(root), [])
    },
  )
})

test('a daemon / contracts bare import fails', () => {
  withFixtureRepo(
    (root) => {
      writeValidCliTree(root, {
        cliTs: `import { procedureCatalog } from '@porcelain/contracts'
export const COMMANDS = []
`,
      })
    },
    (root) => {
      const failures = checkCliBoundary(root)
      assert.ok(
        failures.some((failure) =>
          failure.includes('imports disallowed bare specifier: @porcelain/contracts'),
        ),
        `expected contracts import violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test('an HTTP listener construction fails', () => {
  withFixtureRepo(
    (root) => {
      writeValidCliTree(root, {
        cliTs: `import { createServer } from 'node:http'
export const COMMANDS = []
createServer().listen(0)
`,
      })
    },
    (root) => {
      const failures = checkCliBoundary(root)
      assert.ok(
        failures.some((failure) => failure.includes('forbidden network module: node:http')),
        `expected node:http import violation, got: ${JSON.stringify(failures)}`,
      )
      assert.ok(
        failures.some((failure) => failure.includes('createServer(')),
        `expected createServer call violation, got: ${JSON.stringify(failures)}`,
      )
      assert.ok(
        failures.some((failure) => failure.includes('.listen(')),
        `expected .listen( call violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test('a non-workspace runtime dependency fails', () => {
  withFixtureRepo(
    (root) => {
      writeValidCliTree(root, {
        packageJson: JSON.stringify(
          {
            name: '@porcelain/cli',
            dependencies: {
              '@porcelain/shared': 'workspace:*',
              ws: '^8.0.0',
            },
          },
          null,
          2,
        ),
      })
    },
    (root) => {
      const failures = checkCliBoundary(root)
      assert.ok(
        failures.some((failure) =>
          failure.includes('exactly one runtime dependency @porcelain/shared: workspace:*'),
        ),
        `expected dependency violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test('a direct final-file JSON write fails', () => {
  withFixtureRepo(
    (root) => {
      writeValidCliTree(root, {
        projectIo: `import { writeFileSync } from 'node:fs'

export function writeProjectJson(repoPath, fileName, value) {
  const path = \`\${repoPath}/\${fileName}\`
  writeFileSync(path, JSON.stringify(value, null, 2))
}
`,
      })
    },
    (root) => {
      const failures = checkCliBoundary(root)
      assert.ok(
        failures.some((failure) => failure.includes('must not writeFileSync(path,')),
        `expected direct-write violation, got: ${JSON.stringify(failures)}`,
      )
      assert.ok(
        failures.some((failure) => failure.includes('temporary path then renameSync')),
        `expected missing atomic pattern violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test("a 'run' registry entry fails", () => {
  withFixtureRepo(
    (root) => {
      writeValidCliTree(root, {
        cliTs: `export const COMMANDS = [
  { noun: 'terminal', verbs: [{ verb: 'run', args: '--command', desc: 'Execute' }] },
]
`,
      })
    },
    (root) => {
      const failures = checkCliBoundary(root)
      assert.ok(
        failures.some((failure) => failure.includes("forbidden 'run' command verb")),
        `expected run-verb violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test('an external option on the CLI build fails', () => {
  withFixtureRepo(
    (root) => {
      writeValidCliTree(root, {
        buildNode: `import { join } from 'node:path'
const common = { bundle: true }
async function buildProtocol() {
  await esbuild.build({ ...common, external: ['zod'] })
}
async function buildCli() {
  const outfile = join(outMain, 'cli', 'porcelain.js')
  await esbuild.build({
    ...common,
    entryPoints: [join(root, 'apps', 'cli', 'src', 'porcelain.ts')],
    outfile,
    packages: 'bundle',
    external: ['ws'],
  })
}
`,
      })
    },
    (root) => {
      const failures = checkCliBoundary(root)
      assert.ok(
        failures.some((failure) =>
          failure.includes('buildCli must not declare an external option'),
        ),
        `expected external CLI build violation, got: ${JSON.stringify(failures)}`,
      )
      // buildProtocol's external must not poison the CLI check when CLI is clean — covered
      // by the valid fixture which includes buildProtocol with external: ['zod'].
    },
  )
})

test('a relative import resolving outside apps/cli/src fails', () => {
  withFixtureRepo(
    (root) => {
      writeValidCliTree(root, {
        cliTs: `import { something } from '../../../packages/shared/src/index'
export const COMMANDS = []
`,
      })
      writeFixtureFile(root, 'packages/shared/src/index.ts', 'export const something = 1\n')
    },
    (root) => {
      const failures = checkCliBoundary(root)
      assert.ok(
        failures.some((failure) => failure.includes('imports outside apps/cli/src')),
        `expected outside-root import violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test('devDependencies alone do not fail the package rule', () => {
  withFixtureRepo(
    (root) => {
      writeValidCliTree(root, {
        packageJson: JSON.stringify(
          {
            name: '@porcelain/cli',
            dependencies: { '@porcelain/shared': 'workspace:*' },
            devDependencies: {
              typescript: '^5.0.0',
              '@types/node': '^22.0.0',
              vitest: '^3.0.0',
            },
          },
          null,
          2,
        ),
      })
    },
    (root) => {
      assert.deepEqual(checkCliBoundary(root), [])
    },
  )
})

test('buildProtocol external does not fail when buildCli stays clean', () => {
  withFixtureRepo(
    (root) => {
      writeValidCliTree(root)
    },
    (root) => {
      // writeValidCliTree already includes buildProtocol with external: ['zod']
      assert.deepEqual(checkCliBoundary(root), [])
    },
  )
})
