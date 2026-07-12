import type { Dirent } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
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

/** The slash commands in `dirs`, each with its parsed description, sorted by name. */
export async function listCommandFiles(
  dirs: string[],
  recursive: boolean,
): Promise<AgentCommand[]> {
  const files = await scan(dirs, recursive)
  const commands: AgentCommand[] = []
  for (const file of files.values()) {
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
