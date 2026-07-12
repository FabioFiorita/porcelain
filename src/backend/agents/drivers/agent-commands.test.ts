import { mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  commandNameFromRelPath,
  expandCommandTemplate,
  parseCommandDescription,
  parseSlashInvocation,
} from './agent-commands'
import { expandSlashCommand, listCommandFiles, listCommandsAndSkills } from './agent-commands-fs'

describe('commandNameFromRelPath', () => {
  it('strips .md and namespaces nested dirs with a colon', () => {
    expect(commandNameFromRelPath('hello.md')).toBe('hello')
    expect(commandNameFromRelPath('foo/bar.md')).toBe('foo:bar')
    expect(commandNameFromRelPath('a/b/c.md')).toBe('a:b:c')
  })

  it('is separator- and case-agnostic', () => {
    expect(commandNameFromRelPath('foo\\bar.MD')).toBe('foo:bar')
  })
})

describe('parseCommandDescription', () => {
  it('reads a frontmatter description (unquoted or quoted)', () => {
    expect(parseCommandDescription('---\ndescription: Do the thing\n---\nbody')).toBe(
      'Do the thing',
    )
    expect(parseCommandDescription('---\ndescription: "Quoted desc"\n---\n')).toBe('Quoted desc')
  })

  it('falls back to a leading markdown heading', () => {
    expect(parseCommandDescription('# Review the diff\n\nmore')).toBe('Review the diff')
  })

  it('returns undefined when the first content line is not a heading', () => {
    expect(parseCommandDescription('Just prose here')).toBeUndefined()
    expect(parseCommandDescription('---\nmodel: haiku\n---\nprose')).toBeUndefined()
  })

  it('prefers frontmatter description over a later heading', () => {
    expect(parseCommandDescription('---\ndescription: From FM\n---\n# Heading')).toBe('From FM')
  })
})

describe('parseSlashInvocation', () => {
  it('splits a slash call into name + trimmed args', () => {
    expect(parseSlashInvocation('/review the auth code')).toEqual({
      name: 'review',
      args: 'the auth code',
    })
    expect(parseSlashInvocation('/deploy')).toEqual({ name: 'deploy', args: '' })
    expect(parseSlashInvocation('/foo:bar  x ')).toEqual({ name: 'foo:bar', args: 'x' })
  })

  it('returns null for non-slash text', () => {
    expect(parseSlashInvocation('hello /review')).toBeNull()
    expect(parseSlashInvocation('  /review')).toBeNull()
  })
})

describe('expandCommandTemplate', () => {
  it('substitutes $ARGUMENTS and positional $1..$9', () => {
    expect(expandCommandTemplate('Fix $ARGUMENTS now', 'the bug')).toBe('Fix the bug now')
    expect(expandCommandTemplate('$1 then $2', 'alpha beta')).toBe('alpha then beta')
    expect(expandCommandTemplate('has $3?', 'only one')).toBe('has ?')
  })

  it('strips a leading frontmatter block and trims', () => {
    expect(expandCommandTemplate('---\ndescription: x\n---\nRun $ARGUMENTS\n', 'tests')).toBe(
      'Run tests',
    )
  })
})

describe('command filesystem scan', () => {
  let root: string
  let repo: string
  let home: string

  beforeEach(async () => {
    root = join(tmpdir(), `porcelain-cmd-test-${Math.random().toString(36).slice(2)}`)
    repo = join(root, 'repo', '.claude', 'commands')
    home = join(root, 'home', '.claude', 'commands')
    await mkdir(join(repo, 'sub'), { recursive: true })
    await mkdir(home, { recursive: true })
    await writeFile(join(repo, 'hello.md'), '---\ndescription: Say hello\n---\nGreet $ARGUMENTS')
    await writeFile(join(repo, 'sub', 'deep.md'), '# Deep command\n\nbody')
    // A same-named command in home is shadowed by the repo one.
    await writeFile(join(home, 'hello.md'), 'home version')
    await writeFile(join(home, 'global.md'), 'no description here')
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('lists commands recursively, namespacing + deduping repo over home, sorted', async () => {
    const commands = await listCommandFiles([repo, home], true)
    expect(commands).toEqual([
      { name: 'global' },
      { name: 'hello', description: 'Say hello' },
      { name: 'sub:deep', description: 'Deep command' },
    ])
  })

  it('returns [] when the directories are absent', async () => {
    expect(await listCommandFiles([join(root, 'nope')], true)).toEqual([])
  })

  it('expands a known slash command, filling $ARGUMENTS', async () => {
    expect(await expandSlashCommand('/hello world', [repo, home], true)).toBe('Greet world')
  })

  it('passes through an unknown command or non-slash text unchanged', async () => {
    expect(await expandSlashCommand('/unknown x', [repo, home], true)).toBe('/unknown x')
    expect(await expandSlashCommand('plain text', [repo, home], true)).toBe('plain text')
  })
})

describe('listCommandsAndSkills (commands + skills)', () => {
  let root: string
  let repoCommands: string
  let homeCommands: string
  let repoSkills: string
  let homeSkills: string

  beforeEach(async () => {
    root = join(tmpdir(), `porcelain-skill-test-${Math.random().toString(36).slice(2)}`)
    repoCommands = join(root, 'repo', '.claude', 'commands')
    homeCommands = join(root, 'home', '.claude', 'commands')
    repoSkills = join(root, 'repo', '.claude', 'skills')
    homeSkills = join(root, 'home', '.claude', 'skills')
    await mkdir(repoCommands, { recursive: true })
    await mkdir(homeCommands, { recursive: true })
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('lists a skill by directory name with its frontmatter description', async () => {
    await mkdir(join(repoSkills, 'architecture'), { recursive: true })
    await writeFile(
      join(repoSkills, 'architecture', 'SKILL.md'),
      '---\ndescription: The stack and conventions\n---\nbody',
    )
    // A directory without a SKILL.md is not a skill; a loose file is ignored too.
    await mkdir(join(repoSkills, 'not-a-skill'), { recursive: true })
    await writeFile(join(repoSkills, 'loose.md'), 'ignored')

    expect(await listCommandsAndSkills([], [repoSkills])).toEqual([
      { name: 'architecture', description: 'The stack and conventions' },
    ])
  })

  it('follows a symlinked skill directory (stat, not lstat)', async () => {
    // Mirrors this repo: `.claude/skills/<name>` symlinks to `.agents/skills/<name>`.
    const realSkills = join(root, 'repo', '.agents', 'skills')
    await mkdir(join(realSkills, 'shadcn'), { recursive: true })
    await writeFile(
      join(realSkills, 'shadcn', 'SKILL.md'),
      '---\ndescription: UI primitives\n---\nbody',
    )
    await mkdir(repoSkills, { recursive: true })
    await symlink(join(realSkills, 'shadcn'), join(repoSkills, 'shadcn'))

    expect(await listCommandsAndSkills([], [repoSkills])).toEqual([
      { name: 'shadcn', description: 'UI primitives' },
    ])
  })

  it('lets a repo skill shadow a user-global skill of the same name', async () => {
    await mkdir(join(repoSkills, 'audit'), { recursive: true })
    await writeFile(join(repoSkills, 'audit', 'SKILL.md'), '---\ndescription: Repo audit\n---\n')
    await mkdir(join(homeSkills, 'audit'), { recursive: true })
    await writeFile(join(homeSkills, 'audit', 'SKILL.md'), '---\ndescription: Home audit\n---\n')

    expect(await listCommandsAndSkills([], [repoSkills, homeSkills])).toEqual([
      { name: 'audit', description: 'Repo audit' },
    ])
  })

  it('dedups a command against a skill of the same name, command first', async () => {
    await writeFile(join(repoCommands, 'review.md'), '---\ndescription: Command review\n---\nbody')
    await mkdir(join(repoSkills, 'review'), { recursive: true })
    await writeFile(join(repoSkills, 'review', 'SKILL.md'), '---\ndescription: Skill review\n---\n')

    expect(await listCommandsAndSkills([repoCommands], [repoSkills])).toEqual([
      { name: 'review', description: 'Command review' },
    ])
  })

  it('merges commands and skills, sorted by name', async () => {
    await writeFile(join(repoCommands, 'deploy.md'), '---\ndescription: Ship it\n---\n')
    await mkdir(join(repoSkills, 'product'), { recursive: true })
    await writeFile(join(repoSkills, 'product', 'SKILL.md'), '---\ndescription: What it is\n---\n')

    expect(await listCommandsAndSkills([repoCommands], [repoSkills])).toEqual([
      { name: 'deploy', description: 'Ship it' },
      { name: 'product', description: 'What it is' },
    ])
  })

  it('returns [] when skill roots are absent', async () => {
    expect(await listCommandsAndSkills([], [join(root, 'nope')])).toEqual([])
  })
})
