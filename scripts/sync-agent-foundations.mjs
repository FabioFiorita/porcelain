import { lstat, readdir, readFile, readlink } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkAgentFoundations } from './lint-agent-foundations.mjs'
import { checkCompanionFoundation } from './lint-companion-foundations.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
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

function hasInternalSkillMetadata(skill) {
  const lines = skill.split('\n')
  if (lines[0] !== '---') return false

  const frontmatterEnd = lines.indexOf('---', 1)
  if (frontmatterEnd === -1) return false

  const frontmatter = lines.slice(1, frontmatterEnd)
  const metadataStart = frontmatter.indexOf('metadata:')
  if (metadataStart === -1) return false

  for (const line of frontmatter.slice(metadataStart + 1)) {
    if (line.length > 0 && !line.startsWith(' ')) break
    if (line === '  internal: true') return true
  }
  return false
}

async function checkSkillAdapters() {
  const bodyOnlyDecoy = '---\nname: decoy\n---\nmetadata:\n  internal: true\n---\n'
  if (hasInternalSkillMetadata(bodyOnlyDecoy)) {
    fail('internal skill metadata checker accepted metadata outside YAML frontmatter')
  }

  const skillsRoot = join(root, '.agents', 'skills')
  for (const entry of await readdir(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skill = await readFile(join(skillsRoot, entry.name, 'SKILL.md'), 'utf8').catch(() => '')
    if (!hasInternalSkillMetadata(skill)) {
      fail(
        `.agents/skills/${entry.name}/SKILL.md must set metadata.internal: true so project skills do not leak through skills.sh`,
      )
    }
    await expectSymlink(
      join(root, '.claude', 'skills', entry.name),
      `../../.agents/skills/${entry.name}`,
    )
  }
}

async function main() {
  if (write) {
    // Adapters are symlinks only; nothing to generate after invariant-reviewer removal.
    console.log(
      'agents:sync · nothing to write (skills + hooks are symlink-checked by agents:check)',
    )
  }

  await expectSymlink(join(root, 'CLAUDE.md'), 'AGENTS.md')
  for (const hook of ['git-guard.sh', 'worktree-create.sh', 'worktree-remove.sh']) {
    await expectSymlink(join(root, '.claude', 'hooks', hook), `../../.agents/hooks/${hook}`)
  }
  await checkSkillAdapters()
  for (const failure of checkCompanionFoundation(root)) {
    fail(`skills/porcelain-companion: ${failure}`)
  }
  for (const failure of checkAgentFoundations(root)) {
    fail(`foundation discovery: ${failure}`)
  }

  const settings = JSON.parse(await readFile(join(root, '.claude', 'settings.json'), 'utf8'))
  const settingsText = JSON.stringify(settings)
  if (!settingsText.includes('.claude/hooks/git-guard.sh')) {
    fail('.claude/settings.json does not load the shared Git guard')
  }
  const worktreeHooks = [
    ['WorktreeCreate', 'worktree-create.sh'],
    ['WorktreeRemove', 'worktree-remove.sh'],
  ]
  for (const [event, hook] of worktreeHooks) {
    if (!settingsText.includes(`.claude/hooks/${hook}`) || !settingsText.includes(`"${event}"`)) {
      fail(`.claude/settings.json does not bridge ${event} to the managed worktree lifecycle`)
    }
  }

  if (!process.exitCode) {
    console.log(`agents:${write ? 'sync' : 'check'} · shared foundations are in sync`)
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
