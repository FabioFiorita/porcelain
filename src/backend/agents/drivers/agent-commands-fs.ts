import type { Dirent } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { AgentCommand } from '../types'
import {
  commandNameFromRelPath,
  expandCommandTemplate,
  parseCommandDescription,
  parseSlashInvocation,
} from './agent-commands'

/**
 * The impure half of custom-slash-command support: walk a CLI's command directories for
 * `.md` files and (a) list them for the picker or (b) expand a `/name` invocation into the
 * prompt it stands for. Shared by every driver whose CLI keeps commands as markdown files;
 * the naming/parsing/expansion is the pure sibling `agent-commands.ts`. A missing directory
 * or unreadable file is skipped, never thrown.
 */

interface CommandFile {
  name: string
  path: string
}

// Collect `.md` files under `dir`, naming each relative to `root` (so nested dirs namespace
// with `:`). `recursive` walks subdirectories (Claude); flat (`false`) is one level (Codex,
// OpenCode). An absent/unreadable directory yields nothing.
async function collect(
  root: string,
  dir: string,
  recursive: boolean,
  out: CommandFile[],
): Promise<void> {
  let entries: Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return // directory absent — no commands here
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (recursive) await collect(root, full, recursive, out)
      continue
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    out.push({ name: commandNameFromRelPath(relative(root, full)), path: full })
  }
}

// Every direct child directory of `root` that holds a `SKILL.md` is one command — its name
// is the directory name, its description the SKILL.md frontmatter (read later, in common with
// commands). Modern Claude Code exposes skills as slash invocations (`/architecture`), so the
// picker treats them as commands. Follows symlinks: in this very repo `.claude/skills/*` are
// symlinks into `.agents/skills/*`, and `withFileTypes` dirents report a symlink as a symlink
// (not a directory), so we `stat` (which follows) the candidate SKILL.md rather than trusting
// the dirent's type. An absent/unreadable root yields nothing.
async function collectSkills(root: string, out: CommandFile[]): Promise<void> {
  let entries: Dirent[]
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return // directory absent — no skills here
  }
  for (const entry of entries) {
    if (entry.isFile()) continue // a plain file can't be a skill directory
    const path = join(root, entry.name, 'SKILL.md')
    try {
      if (!(await stat(path)).isFile()) continue
    } catch {
      continue // no SKILL.md under this child — not a skill
    }
    out.push({ name: entry.name, path })
  }
}

// Scan every directory in order, first occurrence of a name winning (repo-local dirs are
// listed before the user-global ones so a repo command shadows a global of the same name).
async function scan(dirs: string[], recursive: boolean): Promise<Map<string, CommandFile>> {
  const seen = new Map<string, CommandFile>()
  for (const dir of dirs) {
    const found: CommandFile[] = []
    await collect(dir, dir, recursive, found)
    for (const file of found) if (!seen.has(file.name)) seen.set(file.name, file)
  }
  return seen
}

// Resolve a name→file map into sorted, described commands (frontmatter description; an
// unreadable file is listed without one).
async function describe(files: Iterable<CommandFile>): Promise<AgentCommand[]> {
  const commands: AgentCommand[] = []
  for (const file of files) {
    let description: string | undefined
    try {
      description = parseCommandDescription(await readFile(file.path, 'utf8'))
    } catch {
      // unreadable file — list it without a description
    }
    commands.push({ name: file.name, ...(description ? { description } : {}) })
  }
  return commands.sort((a, b) => a.name.localeCompare(b.name))
}

/** The slash commands in `dirs`, each with its parsed description, sorted by name. */
export async function listCommandFiles(
  dirs: string[],
  recursive: boolean,
): Promise<AgentCommand[]> {
  return describe((await scan(dirs, recursive)).values())
}

/**
 * Claude's invocable slash commands: the `.md` commands in `commandDirs` (recursive, `:`
 * namespaced) PLUS the skills in `skillDirs` (each `<dir>/SKILL.md`). One combined, deduped
 * list — a command shadows a skill of the same name (commands scanned first), and within each
 * kind the first dir wins (repo-local before user-global). Sorted by name.
 */
export async function listCommandsAndSkills(
  commandDirs: string[],
  skillDirs: string[],
): Promise<AgentCommand[]> {
  const seen = await scan(commandDirs, true)
  for (const dir of skillDirs) {
    const found: CommandFile[] = []
    await collectSkills(dir, found)
    for (const file of found) if (!seen.has(file.name)) seen.set(file.name, file)
  }
  return describe(seen.values())
}

/**
 * If `text` is a `/name …` invocation of a command in `dirs`, return the expanded prompt;
 * otherwise (not a slash call, or an unknown/unreadable command) return `text` unchanged.
 * For CLIs that don't expand `/name` themselves (Codex, OpenCode).
 */
export async function expandSlashCommand(
  text: string,
  dirs: string[],
  recursive: boolean,
): Promise<string> {
  const invocation = parseSlashInvocation(text)
  if (!invocation) return text
  const file = (await scan(dirs, recursive)).get(invocation.name)
  if (!file) return text
  try {
    return expandCommandTemplate(await readFile(file.path, 'utf8'), invocation.args)
  } catch {
    return text // unreadable command file — send the raw text
  }
}
