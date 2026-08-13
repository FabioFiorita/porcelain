#!/usr/bin/env node
/** Fixture tests for the AGT-001 ownership-map shape and retirement guard. */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { checkOwnershipMap } from './lint-foundation-ownership.mjs'

const HEADER = '| ID | Legacy source | Current owner | Permanent source | Proof | Gate | Status |'
const SHIP_HEADING = '## Ship responsibility map'

function writeFile(root, relativePath, content = '') {
  const absolute = path.join(root, relativePath)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

function withFixture(build, run) {
  const root = mkdtempSync(path.join(tmpdir(), 'lint-foundation-ownership-'))
  const mapPath = path.join(root, 'docs/internals/agent-foundations.md')
  try {
    mkdirSync(path.dirname(mapPath), { recursive: true })
    build(root, mapPath)
    run(root, mapPath)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function fixtureMap(row) {
  return `${SHIP_HEADING}\n\n${HEADER}\n| --- | --- | --- | --- | --- | --- | --- |\n${row}\n`
}

function validRow() {
  return '| `SHIP-01` | `.agents/skills/ship/SKILL.md` | Root | [AGENTS.md](../../AGENTS.md) | [proof.test.mjs](../../proof.test.mjs) | `pnpm lint` | Complete |'
}

function runFixture(markdown, assertion) {
  withFixture(
    (root) => {
      writeFile(root, 'AGENTS.md', '# root\n')
      writeFile(root, 'proof.test.mjs', 'export {}\n')
      writeFile(root, 'docs/internals/agent-foundations.md', markdown)
    },
    (root, mapPath) =>
      assertion(
        checkOwnershipMap(markdown, root, {
          mapPath,
          requiredIds: ['SHIP-01'],
          requiredSections: [SHIP_HEADING.slice(3)],
        }),
      ),
  )
}

test('a complete row with current links passes', () => {
  runFixture(fixtureMap(validRow()), (failures) => assert.deepEqual(failures, []))
})

test('an empty owner is rejected', () => {
  runFixture(fixtureMap(validRow().replace('| Root |', '|  |')), (failures) => {
    assert.ok(failures.some((failure) => failure.includes('missing current owner')))
  })
})

test('an empty proof is rejected', () => {
  runFixture(
    fixtureMap(validRow().replace('| [proof.test.mjs](../../proof.test.mjs) |', '|  |')),
    (failures) => {
      assert.ok(failures.some((failure) => failure.includes('missing proof')))
    },
  )
})

test('a broken proof link is rejected', () => {
  runFixture(
    fixtureMap(validRow().replaceAll('proof.test.mjs', 'missing.test.mjs')),
    (failures) => {
      assert.ok(failures.some((failure) => failure.includes('proof links to missing path')))
    },
  )
})

test('a Complete row cannot keep Ship or Audit as its permanent source', () => {
  withFixture(
    (root) => {
      writeFile(root, '.agents/skills/audit/SKILL.md', '# old\n')
      writeFile(root, 'proof.test.mjs', 'export {}\n')
      writeFile(
        root,
        'docs/internals/agent-foundations.md',
        fixtureMap(
          validRow().replace(
            '[AGENTS.md](../../AGENTS.md)',
            '[old](../../.agents/skills/audit/SKILL.md)',
          ),
        ),
      )
    },
    (root, mapPath) => {
      const failures = checkOwnershipMap(readFileMap(mapPath), root, {
        mapPath,
        requiredIds: ['SHIP-01'],
        requiredSections: [SHIP_HEADING.slice(3)],
      })
      assert.ok(failures.some((failure) => failure.includes('Complete permanent source')))
    },
  )
})

function readFileMap(mapPath) {
  return readFileSync(mapPath, 'utf8')
}
