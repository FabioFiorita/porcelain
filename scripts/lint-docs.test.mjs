import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  ALLOWED_SHIPPED,
  findDocProblems,
  findRoutingProblems,
  reachesIntoCheckout,
  relativeDocReferences,
  SHIPPED_ROOT,
} from './lint-docs.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('a document routed once is the shape being protected', () => {
  const router = 'Read [docs/development.md](docs/development.md) when setting up.'
  assert.deepEqual(findRoutingProblems(router, ['docs/development.md']), [])
})

test('a document routed twice is a second owner', () => {
  const router =
    'Read [docs/development.md](docs/development.md) when setting up.\nSetup lives in `docs/development.md`.'
  const problems = findRoutingProblems(router, ['docs/development.md'])
  assert.equal(problems.length, 1)
  assert.match(problems[0], /routed 2 times/)
})

test('a document nothing routes to is unreachable', () => {
  const problems = findRoutingProblems('Read [docs/release.md](docs/release.md).', [
    'docs/orphan.md',
    'docs/release.md',
  ])
  assert.deepEqual(problems, ['docs/orphan.md is routed from nowhere'])
})

test('a shipped skill pointing into the checkout is refused', () => {
  const source = 'Full model: `docs/remote-access.md` in the main repo.'
  assert.equal(
    reachesIntoCheckout(
      `${SHIPPED_ROOT}/porcelain/skills/porcelain-remote/references/pairing.md`,
      source,
    ),
    true,
  )
})

test('a public URL is reachable from an installed copy', () => {
  const source =
    'Full model: [remote-access.md](https://github.com/FabioFiorita/porcelain/blob/main/docs/remote-access.md).'
  assert.deepEqual(relativeDocReferences(source), [])
  assert.equal(reachesIntoCheckout(`${SHIPPED_ROOT}/porcelain/skills/x/SKILL.md`, source), false)
})

test('an internal skill may read this checkout', () => {
  const source = 'Read `docs/development.md` for the shared worktree loop.'
  assert.equal(reachesIntoCheckout('.agents/skills/merge-queue/SKILL.md', source), false)
})

test('the repository routes every document exactly once and ships nothing that needs it', () => {
  assert.deepEqual(findDocProblems(), [])
})

test('every allowlisted shipped file still exists, so the list cannot rot', () => {
  for (const [path, reason] of Object.entries(ALLOWED_SHIPPED)) {
    assert.ok(existsSync(join(root, path)), `${path} is allowlisted (${reason}) but is gone`)
  }
})
