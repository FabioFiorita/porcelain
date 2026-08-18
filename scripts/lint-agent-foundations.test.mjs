#!/usr/bin/env node
/** Fixture tests for AGT-003 root/focused foundation discovery and removal checks. */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { checkFoundationDiscovery, REQUIRED_DISCOVERY_FILES } from './lint-agent-foundations.mjs'

function writeFile(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath)
  mkdirSync(path.dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function withFixture(build, run) {
  const root = mkdtempSync(path.join(tmpdir(), 'lint-agent-foundations-'))
  try {
    writeFile(
      root,
      'AGENTS.md',
      '## Delivery loop\nUse Porcelain Companion only when intentionally operating companion surfaces.\n',
    )
    for (const relativePath of REQUIRED_DISCOVERY_FILES.slice(1))
      writeFile(root, relativePath, '# current\n')
    build(root)
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('current root and focused discovery surfaces pass', () => {
  withFixture(
    (_) => {},
    (root) => assert.deepEqual(checkFoundationDiscovery(root), []),
  )
})

test('a retired skill reference is rejected', () => {
  withFixture(
    (root) =>
      writeFile(
        root,
        'AGENTS.md',
        '## Delivery loop\nLoad the audit skill before edits.\nUse Porcelain Companion only when intentionally operating.\n',
      ),
    (root) =>
      assert.ok(checkFoundationDiscovery(root).some((failure) => failure.includes('skill'))),
  )
})

test('missing focused procedure is rejected', () => {
  withFixture(
    (root) => rmSync(path.join(root, '.agents/skills/web-e2e/SKILL.md')),
    (root) =>
      assert.ok(checkFoundationDiscovery(root).some((failure) => failure.includes('web-e2e'))),
  )
})

test('missing root delivery loop is rejected', () => {
  withFixture(
    (root) =>
      writeFile(root, 'AGENTS.md', 'Use Porcelain Companion only when intentionally operating.\n'),
    (root) =>
      assert.ok(
        checkFoundationDiscovery(root).some((failure) => failure.includes('Delivery loop')),
      ),
  )
})

/**
 * A gitignored machine-local config symlinked at a checkout that has since moved
 * leaves a dangling entry the walk still lists. Crashing there blocked every
 * commit in the worktree with a raw ENOENT stack; an unreadable file is simply
 * not evidence of a retired reference.
 */
test('a dangling symlink is skipped rather than crashing the gate', () => {
  withFixture(
    (root) => {
      mkdirSync(path.join(root, '.claude'), { recursive: true })
      symlinkSync(
        path.join(root, 'nowhere', 'settings.local.json'),
        path.join(root, '.claude', 'settings.local.json'),
      )
    },
    (root) => assert.deepEqual(checkFoundationDiscovery(root), []),
  )
})
