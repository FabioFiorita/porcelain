import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Builtins only — see protocol.ts. The repo-notes channel: the human's freeform
// per-repo markdown scratchpad (Porcelain app, notes-store.ts), READ-ONLY here.
// ONE-WAY, app→agent — the human writes notes in Porcelain (Files → Notes); the agent
// reads them as standing project context (conventions, gotchas, what to do next).
// Unlike the board/comment/action channels the app is the SOLE writer, so there is no
// write tool and nothing to flip back. Lenient parse of our own file: never throw.

type Notes = Record<string, string>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function notesPath(): string {
  return process.env.PORCELAIN_NOTES ?? join(homedir(), '.porcelain', 'notes.json')
}

function readAll(): Notes {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(notesPath(), 'utf8'))
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const all: Notes = {}
  for (const [repoPath, value] of Object.entries(parsed)) {
    if (typeof value === 'string') all[repoPath] = value
  }
  return all
}

/** The human's notes for a repo ('' when none / file absent). */
export function readNotes(repoPath: string): string {
  return readAll()[repoPath] ?? ''
}

/** Render the repo notes for `get_repo_notes`: the markdown verbatim, or a hint when empty. */
export function describeNotes(repoPath: string, notes: string): string {
  if (notes.trim() === '') {
    return `No project notes for ${repoPath}. The human keeps a freeform per-repo notes scratchpad in Porcelain (Files → Notes); when they write in it, it shows up here as project context.`
  }
  return `Project notes for ${repoPath} (the human's freeform scratchpad):\n\n${notes}`
}
