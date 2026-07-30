import { lstat, readdir, readFile, readlink, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const canonicalAgent = join(root, '.agents', 'agents', 'invariant-reviewer.md')
const codexAgent = join(root, '.codex', 'agents', 'invariant-reviewer.toml')
const write = process.argv.includes('--write')

function fail(message) {
  console.error(`agents:check · ${message}`)
  process.exitCode = 1
}

async function expectSymlink(path, expectedTarget) {
  try {
    const stat = await lstat(path)
    if (!stat.isSymbolicLink()) {
      fail(`${relative(root, path)} must be a symlink`)
      return
    }
    const target = await readlink(path)
    if (target !== expectedTarget) {
      fail(`${relative(root, path)} points to ${target}; expected ${expectedTarget}`)
    }
  } catch {
    fail(`${relative(root, path)} is missing`)
  }
}

function parseAgent(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]+)$/)
  if (!match) throw new Error('canonical reviewer needs YAML frontmatter and a body')

  const fields = new Map()
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':')
    if (separator === -1) continue
    fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim())
  }

  const name = fields.get('name')
  const description = fields.get('description')
  if (!name || !description) throw new Error('canonical reviewer needs name and description')
  return { name, description, body: match[2].trimEnd() }
}

function codexToml({ name, description, body }) {
  return `# Generated from .agents/agents/invariant-reviewer.md by pnpm agents:sync. Do not edit.\nname = ${JSON.stringify(name)}\ndescription = ${JSON.stringify(description)}\ndeveloper_instructions = ${JSON.stringify(body)}\n`
}

async function checkSkillAdapters() {
  const skillsRoot = join(root, '.agents', 'skills')
  for (const entry of await readdir(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    await expectSymlink(
      join(root, '.claude', 'skills', entry.name),
      `../../.agents/skills/${entry.name}`,
    )
  }
}

async function main() {
  await expectSymlink(join(root, 'CLAUDE.md'), 'AGENTS.md')
  await expectSymlink(
    join(root, '.claude', 'agents', 'invariant-reviewer.md'),
    '../../.agents/agents/invariant-reviewer.md',
  )
  await expectSymlink(
    join(root, '.claude', 'hooks', 'git-guard.sh'),
    '../../.agents/hooks/git-guard.sh',
  )
  await checkSkillAdapters()

  const canonical = parseAgent(await readFile(canonicalAgent, 'utf8'))
  const expectedCodex = codexToml(canonical)
  if (write) {
    await writeFile(codexAgent, expectedCodex)
    console.log('agents:sync · wrote .codex/agents/invariant-reviewer.toml')
  } else {
    const actualCodex = await readFile(codexAgent, 'utf8').catch(() => '')
    if (actualCodex !== expectedCodex) {
      fail('.codex/agents/invariant-reviewer.toml drifted; run pnpm agents:sync')
    }
  }

  const settings = JSON.parse(await readFile(join(root, '.claude', 'settings.json'), 'utf8'))
  const settingsText = JSON.stringify(settings)
  if (!settingsText.includes('.claude/hooks/git-guard.sh')) {
    fail('.claude/settings.json does not load the shared Git guard')
  }

  if (!process.exitCode) {
    console.log(`agents:${write ? 'sync' : 'check'} · shared foundations are in sync`)
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
