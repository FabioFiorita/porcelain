import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { evaluate, hashPlugin, pluginFiles } from './plugin-version.mjs'

const base = {
  agentVersion: '1.0.0',
  claudeVersion: '1.0.0',
  marketplaceVersion: null,
  hash: 'aaa',
  locked: { version: '1.0.0', hash: 'aaa' },
}

test('clean state has no problems and nothing to relock', () => {
  const { problems, changed } = evaluate(base)
  assert.deepEqual(problems, [])
  assert.equal(changed, false)
})

test('content change without a version bump is refused', () => {
  const { problems, changed } = evaluate({ ...base, hash: 'bbb' })
  assert.equal(changed, true)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /still 1\.0\.0/)
})

test('content change with a version bump is allowed', () => {
  const { problems, changed } = evaluate({
    ...base,
    agentVersion: '1.1.0',
    claudeVersion: '1.1.0',
    hash: 'bbb',
  })
  assert.deepEqual(problems, [])
  assert.equal(changed, true)
})

test('the two manifests must agree', () => {
  const { problems } = evaluate({ ...base, claudeVersion: '1.0.1' })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /must agree/)
})

test('a marketplace entry that pins a version must match', () => {
  assert.deepEqual(evaluate({ ...base, marketplaceVersion: '1.0.0' }).problems, [])
  assert.match(
    evaluate({ ...base, marketplaceVersion: '0.9.0' }).problems[0],
    /omit the field or match it/,
  )
})

test('a version bump with no content change still needs a relock', () => {
  const { problems } = evaluate({ ...base, agentVersion: '1.1.0', claudeVersion: '1.1.0' })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /records 1\.0\.0/)
})

test('first run bootstraps without demanding a bump', () => {
  const { problems, changed } = evaluate({ ...base, locked: null })
  assert.deepEqual(problems, [])
  assert.equal(changed, true)
})

test('the hash covers the real shipped files and excludes the lock', () => {
  const files = pluginFiles()
  assert.ok(files.some((f) => f.endsWith('skills/companion/SKILL.md')))
  assert.ok(files.some((f) => f.endsWith('.codex-plugin/plugin.json')))
  assert.ok(files.some((f) => f.endsWith('.claude-plugin/plugin.json')))
  assert.ok(!files.some((f) => f.endsWith('plugin.lock.json')))
  assert.match(hashPlugin(), /^[0-9a-f]{64}$/)
})

test('MCP descriptors identify their server as Porcelain', () => {
  for (const relativePath of [
    '../plugins/porcelain/mcp.json',
    '../plugins/porcelain/.mcp.json',
  ]) {
    const descriptor = JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'))
    assert.deepEqual(Object.keys(descriptor.mcpServers), ['Porcelain'])
  }
})
