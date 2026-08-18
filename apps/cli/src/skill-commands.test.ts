import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMMANDS } from './cli'

// The shipped companion skill is the manual agents read before touching the CLI. A verb it
// cites that the CLI never had — or lost in a rollback — is a dead end an agent only finds
// at runtime, in someone else's repo. Nothing else checks the two against each other.

const toplevel = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim()
const skillDir = join(toplevel, 'skills', 'porcelain-companion')

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(entry.parentPath, entry.name))
}

const nouns = COMMANDS.map((command) => command.noun).join('|')
const known = new Set(
  COMMANDS.flatMap((noun) => noun.verbs.map((verb) => `${noun.noun} ${verb.verb}`)),
)

describe('the shipped skill only cites commands the CLI has', () => {
  const files = markdownFiles(skillDir)

  it('finds the skill on disk', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(files)('%s', (file) => {
    const text = readFileSync(file, 'utf8')
    // Only `porcelain`-prefixed invocations, so prose like "the review set" is not a match.
    // The third token is optional because `worktree profile get` is three words;
    // a citation counts as known if EITHER length matches, so the trailing word of
    // a sentence after `porcelain profile get` is not read as part of the verb.
    const cited = [
      ...text.matchAll(new RegExp(`porcelain (${nouns}) ([a-z][a-z-]*)( [a-z][a-z-]*)?`, 'g')),
    ].map((match) => ({
      two: `${match[1]} ${match[2]}`,
      three: `${match[1]} ${match[2]}${match[3] ?? ''}`,
    }))
    const unknown = cited
      .filter((command) => !known.has(command.three) && !known.has(command.two))
      .map((command) => command.three)
    expect([...new Set(unknown)]).toEqual([])
  })
})
