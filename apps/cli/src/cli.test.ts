import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listCanvasesForRepo, privateCanvasBundlePath } from './canvas-file'
import { COMMANDS, runCli } from './cli'

const root = join(tmpdir(), 'porcelain-cli-test')
const repoPath = join(root, 'repo')
const homeDir = join(root, 'home')
const prevHome = process.env.PORCELAIN_HOME
const PROJECT_ID = 'proj-cli'

/**
 * Actions and Canvases live in the daemon-root Project store keyed by a Project id the
 * daemon minted (ADR 0002), so the CLI needs the same `hub-inventory.json` the daemon
 * wrote. A temp PORCELAIN_HOME also keeps these tests off the real machine's channels.
 */
function seedHubInventory(): void {
  const commonGitDir = realpathSync(join(repoPath, '.git'))
  mkdirSync(homeDir, { recursive: true })
  writeFileSync(
    join(homeDir, 'hub-inventory.json'),
    JSON.stringify({
      version: 1,
      value: {
        projects: [
          {
            id: PROJECT_ID,
            commonGitDir,
            groupingKey: 'name:repo',
            name: 'repo',
            worktrees: [{ id: 'wt-cli', gitDir: commonGitDir }],
          },
        ],
      },
    }),
  )
}

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repoPath, { recursive: true })
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: repoPath })
  process.env.PORCELAIN_HOME = homeDir
  seedHubInventory()
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  if (prevHome === undefined) delete process.env.PORCELAIN_HOME
  else process.env.PORCELAIN_HOME = prevHome
})
// Every command targets a real temp repo path.
const repo = ['--repo', repoPath]

const porcelain = (...parts: string[]): string => join(repoPath, '.porcelain', ...parts)
const doc = `<main>${'x'.repeat(600)}</main>`
const read = (): {
  name: string
  thesis?: string
  files: unknown[]
  sections?: unknown[]
} => {
  const canvas = listCanvasesForRepo(repoPath).find((entry) => entry.template === 'review')
  if (canvas === undefined) throw new Error('No Review Canvas')
  return JSON.parse(
    readFileSync(join(privateCanvasBundlePath(repoPath, canvas.id), 'review.json'), 'utf8'),
  )
}
/** Saved actions are daemon-root Project data, not repo-local companion data. */
const readActions = (): unknown[] => {
  const raw = JSON.parse(
    readFileSync(join(homeDir, 'projects', PROJECT_ID, 'actions.json'), 'utf8'),
  ) as {
    version: number
    actions: unknown[]
  }
  return raw.actions
}

describe('COMMANDS registry matches the dispatch switch', () => {
  // Static comparison rather than invocation: running every verb would touch the filesystem
  // and need per-verb fixtures, and this catches the same drift with none of that.
  const toplevel = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim()
  const source = readFileSync(join(toplevel, 'apps/cli/src/cli.ts'), 'utf8')
  const dispatched = new Set(
    [...source.matchAll(/^\s*case '([a-z]+ [a-z-]+)':/gm)].map((m) => m[1] as string),
  )
  const documented = new Set(
    COMMANDS.flatMap((noun) => noun.verbs.map((verb) => `${noun.noun} ${verb.verb}`)),
  )

  it('documents every dispatched command', () => {
    expect([...dispatched].filter((cmd) => !documented.has(cmd))).toEqual([])
  })
  it('dispatches every documented command', () => {
    expect([...documented].filter((cmd) => !dispatched.has(cmd))).toEqual([])
  })
  it('found the switch at all (guards the regex itself)', () => {
    expect(dispatched.size).toBeGreaterThan(10)
  })
  // CLI-001: the agent channel never grows a shell-exec `run` verb; process
  // execution belongs to Actions + Terminal, not this filesystem writer.
  it('registers no run verb', () => {
    const runVerbs = COMMANDS.flatMap((noun) =>
      noun.verbs.filter((verb) => verb.verb === 'run').map((verb) => `${noun.noun} ${verb.verb}`),
    )
    expect(runVerbs).toEqual([])
  })
  it('registers unique noun/verb pairs', () => {
    const pairs = COMMANDS.flatMap((noun) => noun.verbs.map((verb) => `${noun.noun} ${verb.verb}`))
    expect(new Set(pairs).size).toBe(pairs.length)
  })
})

describe('runCli — flag parsing, help, repo resolution', () => {
  it('bare invocation and `help` print usage', async () => {
    expect(await runCli([])).toContain('Usage:')
    expect(await runCli(['help'])).toContain('Usage:')
  })
  it('<noun> --help prints the noun usage with its flags', async () => {
    const text = await runCli(['review', '--help'])
    expect(text).toContain('porcelain review')
    expect(text).toContain('--files')
    expect(text).toContain('--repo')
  })
  it('--version prints the baked version', async () => {
    expect(await runCli(['--version'])).toBe(__PORCELAIN_VERSION__)
  })
  it('rejects an unknown command', async () => {
    await expect(runCli(['bogus', 'verb', ...repo])).rejects.toThrow('unknown command')
  })
  it('resolves the repo from git when --repo is omitted', async () => {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
    expect(await runCli(['review', 'get'])).toContain(root)
  })
  it('errors when the cwd is not a git repo and no --repo is given', async () => {
    const nonGit = join(tmpdir(), 'porcelain-cli-nongit')
    rmSync(nonGit, { recursive: true, force: true })
    mkdirSync(nonGit, { recursive: true })
    await expect(runCli(['review', 'get'], { cwd: nonGit })).rejects.toThrow(
      'not inside a git repository',
    )
    rmSync(nonGit, { recursive: true, force: true })
  })
  it('errors when --repo is a relative path', async () => {
    await expect(runCli(['review', 'get', '--repo', 'relative/repo'])).rejects.toThrow(
      '--repo must be an absolute path',
    )
  })
  it('reads --files from stdin when passed "-"', async () => {
    const readStdin = (): string => JSON.stringify([{ path: 'a.ts' }])
    await runCli(['review', 'set', ...repo, '--files', '-'], { readStdin })
    expect(read()?.files).toEqual([{ path: 'a.ts' }])
  })
})

describe('runCli — review', () => {
  it('review set writes a repo-keyed set', async () => {
    await runCli([
      'review',
      'set',
      ...repo,
      '--name',
      'X',
      '--files',
      JSON.stringify([{ path: 'a.ts' }]),
    ])
    expect(read()).toEqual({ name: 'X', files: [{ path: 'a.ts' }], sections: [] })
  })
  it('review set accepts --thesis and --sections and review get round-trips them', async () => {
    const sections = [
      {
        title: 'Entry',
        prose: 'starts **here**',
        html: '<table><tr><td>ok</td></tr></table>',
        htmlHeight: 320,
        anchors: [{ path: 'a.ts', startLine: 1, endLine: 9 }],
      },
    ]
    const out = await runCli([
      'review',
      'set',
      ...repo,
      '--name',
      'Login flow',
      '--thesis',
      'One round-trip instead of three.',
      '--files',
      JSON.stringify([{ path: 'a.ts' }]),
      '--sections',
      JSON.stringify(sections),
    ])
    expect(out).toContain('1 section(s)')
    expect(read()?.thesis).toBe('One round-trip instead of three.')
    expect(read()?.sections).toEqual(sections)
    const text = await runCli(['review', 'get', ...repo])
    expect(text).toContain('1 section(s), thesis set')
    expect(JSON.parse(text.slice(text.indexOf('{')))).toEqual({
      thesis: 'One round-trip instead of three.',
      files: [{ path: 'a.ts' }],
      sections,
    })
  })
  it('review set reads --sections from stdin when passed "-"', async () => {
    const readStdin = (): string => JSON.stringify([{ title: 'Entry', prose: 'piped' }])
    await runCli(
      ['review', 'set', ...repo, '--files', JSON.stringify([{ path: 'a.ts' }]), '--sections', '-'],
      { readStdin },
    )
    expect(read()?.sections).toEqual([{ title: 'Entry', prose: 'piped', anchors: [] }])
  })
  it('review set rejects malformed --sections with an indexed message', async () => {
    await expect(
      runCli([
        'review',
        'set',
        ...repo,
        '--files',
        JSON.stringify([{ path: 'a.ts' }]),
        '--sections',
        JSON.stringify([{ prose: 'no title' }]),
      ]),
    ).rejects.toThrow('sections[0].title must be a non-empty string')
  })
  it('review set rejects an over-cap or non-string section html', async () => {
    await expect(
      runCli([
        'review',
        'set',
        ...repo,
        '--files',
        JSON.stringify([{ path: 'a.ts' }]),
        '--sections',
        JSON.stringify([{ title: 'Entry', prose: 'x', html: 42 }]),
      ]),
    ).rejects.toThrow('sections[0].html must be a string')
    await expect(
      runCli([
        'review',
        'set',
        ...repo,
        '--files',
        JSON.stringify([{ path: 'a.ts' }]),
        '--sections',
        JSON.stringify([{ title: 'Entry', prose: 'x', html: 'a'.repeat(524_289) }]),
      ]),
    ).rejects.toThrow('sections[0].html must be at most 524288 characters')
  })
  it('review set rejects an out-of-range section htmlHeight', async () => {
    await expect(
      runCli([
        'review',
        'set',
        ...repo,
        '--files',
        JSON.stringify([{ path: 'a.ts' }]),
        '--sections',
        JSON.stringify([{ title: 'Entry', prose: 'x', html: '<p>ok</p>', htmlHeight: 40 }]),
      ]),
    ).rejects.toThrow('sections[0].htmlHeight must be an integer between 160 and 1600')
  })
  it('review add keeps the stored thesis and sections (files-only merge)', async () => {
    await runCli([
      'review',
      'set',
      ...repo,
      '--thesis',
      'The why.',
      '--files',
      JSON.stringify([{ path: 'a.ts' }]),
      '--sections',
      JSON.stringify([{ title: 'Entry', prose: 'x' }]),
    ])
    await runCli(['review', 'add', ...repo, '--files', JSON.stringify([{ path: 'b.ts' }])])
    expect(read()?.thesis).toBe('The why.')
    expect(read()?.sections).toHaveLength(1)
    expect(read()?.files).toHaveLength(2)
  })
  it('review set defaults the name to "Active review"', async () => {
    await runCli(['review', 'set', ...repo, '--files', JSON.stringify([{ path: 'a.ts' }])])
    expect(read()?.name).toBe('Active review')
  })
  // The skill's standing rule is to open a unit with name + thesis before touching a file.
  it('review set starts Intent-first, with no --files at all', async () => {
    await runCli(['review', 'set', ...repo, '--name', 'Unit', '--thesis', 'Why this change'])
    expect(read()).toMatchObject({ name: 'Unit', thesis: 'Why this change', files: [] })
  })
  it('review set still validates --files when it is passed', async () => {
    await expect(runCli(['review', 'set', ...repo, '--files', '"nope"'])).rejects.toThrow(
      'files must be an array',
    )
  })
  it('review add merges into the existing set', async () => {
    await runCli(['review', 'set', ...repo, '--files', JSON.stringify([{ path: 'a.ts' }])])
    await runCli(['review', 'add', ...repo, '--files', JSON.stringify([{ path: 'b.ts' }])])
    expect(read()?.files).toEqual([{ path: 'a.ts' }, { path: 'b.ts' }])
  })
  it('review clear removes the daemon-root Review Canvas', async () => {
    await runCli(['review', 'set', ...repo, '--files', JSON.stringify([{ path: 'a.ts' }])])
    const msg = await runCli(['review', 'clear', ...repo])
    expect(msg).toContain('Review Canvas')
    expect(() => read()).toThrow()
  })
  it('review get describes the stored set', async () => {
    await runCli([
      'review',
      'set',
      ...repo,
      '--name',
      'X',
      '--files',
      JSON.stringify([{ path: 'a.ts' }]),
    ])
    expect(await runCli(['review', 'get', ...repo])).toContain(`Review "X" for ${repoPath}`)
  })
  it('review get reports a thesis-only Intent-first start as a real review', async () => {
    await runCli(['review', 'set', ...repo, '--name', 'Unit', '--thesis', 'Why this change'])
    expect(await runCli(['review', 'get', ...repo])).toContain(`Review "Unit"`)
  })
  it('review get still reports a truly empty set as absent', async () => {
    await runCli(['review', 'set', ...repo, '--name', 'Unit'])
    expect(await runCli(['review', 'get', ...repo])).toContain('No review set')
  })
  it('review set-canvas is an unknown command', async () => {
    await expect(
      runCli(['review', 'set-canvas', ...repo, '--medium', 'html', '--html', '<p>x</p>']),
    ).rejects.toThrow('unknown command')
  })
  it('review --help does not list set-canvas or clear-canvas', async () => {
    const text = await runCli(['review', '--help'])
    expect(text).not.toContain('set-canvas')
    expect(text).not.toContain('clear-canvas')
  })
})

describe('runCli — actions', () => {
  it('actions create with title+command writes an action', async () => {
    await runCli(['actions', 'create', ...repo, '--title', 'Dev', '--command', 'pnpm dev'])
    const actions = readActions() as Array<{ title: string; command: string }>
    expect(actions).toHaveLength(1)
    expect(actions[0]?.title).toBe('Dev')
    expect(actions[0]?.command).toBe('pnpm dev')
  })
  it('actions create without --command rejects with "command is required"', async () => {
    await expect(runCli(['actions', 'create', ...repo, '--title', 'Dev'])).rejects.toThrow(
      'command is required',
    )
  })
  it('actions update edits the title and command', async () => {
    await runCli(['actions', 'create', ...repo, '--title', 'Dev', '--command', 'pnpm dev'])
    const id = (readActions() as Array<{ id: string }>)[0]?.id as string
    const result = await runCli([
      'actions',
      'update',
      ...repo,
      '--id',
      id,
      '--title',
      'Build',
      '--command',
      'pnpm build',
    ])
    expect(result).toContain('Updated action')
    const actions = readActions() as Array<{ title: string; command: string }>
    expect(actions[0]?.title).toBe('Build')
    expect(actions[0]?.command).toBe('pnpm build')
  })
  it('actions delete removes the action', async () => {
    await runCli(['actions', 'create', ...repo, '--title', 'Dev', '--command', 'pnpm dev'])
    const id = (readActions() as Array<{ id: string }>)[0]?.id as string
    const result = await runCli(['actions', 'delete', ...repo, '--id', id])
    expect(result).toContain('Deleted action')
    expect((readActions() as unknown[]).length).toBe(0)
  })
  it('project promote-overrides writes the repo-relative overlay file', async () => {
    const result = await runCli([
      'project',
      'promote-overrides',
      ...repo,
      '--hidden',
      'apps/legacy',
      '--pinned',
      'apps/web',
    ])
    expect(result).toContain('apps/legacy')
    const overrides = JSON.parse(readFileSync(porcelain('project.json'), 'utf8')) as unknown
    expect(overrides).toEqual({
      hiddenPaths: ['apps/legacy'],
      pinnedPaths: ['apps/web'],
      worktrees: {},
    })
  })
  it('canvas set --tracked writes the tracked bundle without a daemon-root Project id', async () => {
    const source = join(root, 'canvas-source')
    mkdirSync(source, { recursive: true })
    writeFileSync(join(source, 'index.html'), doc)
    const result = await runCli([
      'canvas',
      'set',
      ...repo,
      '--tracked',
      '--title',
      'Docs',
      '--kind',
      'html',
      '--source-dir',
      source,
    ])
    expect(result).toContain('tracked at')
    const id = /Set Canvas (\S+) /.exec(result)?.[1] as string
    const manifest = JSON.parse(readFileSync(porcelain('canvases', id, 'canvas.json'), 'utf8')) as {
      id: string
      worktreeId: null
      title: string
    }
    expect(manifest.id).toBe(id)
    expect(manifest.worktreeId).toBe(null)
    expect(manifest.title).toBe('Docs')
    expect(readFileSync(porcelain('canvases', id, 'index.html'), 'utf8')).toBe(doc)
  })
})

describe('runCli — tasks (daemon-wide table)', () => {
  // The Tasks table lives under $PORCELAIN_HOME, not in the repo, so this block points
  // the daemon home at the same temp root the rest of the suite tears down.
  const prevHome = process.env.PORCELAIN_HOME
  beforeEach(() => {
    process.env.PORCELAIN_HOME = join(root, 'home')
  })
  afterEach(() => {
    if (prevHome === undefined) delete process.env.PORCELAIN_HOME
    else process.env.PORCELAIN_HOME = prevHome
  })

  const taskIds = (): string[] =>
    (
      JSON.parse(readFileSync(join(root, 'home', 'tasks', 'tasks.json'), 'utf8')) as {
        value: { tasks: Array<{ id: string }> }
      }
    ).value.tasks.map((task) => task.id)

  it('tasks add writes a Task the list reports back', async () => {
    const created = await runCli([
      'tasks',
      'add',
      ...repo,
      '--title',
      'Chase the flake',
      '--tags',
      'infra, flaky',
      '--status',
      'doing',
    ])
    expect(created).toContain('Created Task')
    const list = await runCli(['tasks', 'list', ...repo])
    expect(list).toContain('(doing) Chase the flake')
    expect(list).toContain('[infra, flaky]')
  })

  it('tasks update and tasks done change one Task, and report an unknown id', async () => {
    await runCli(['tasks', 'add', ...repo, '--title', 'Ship it'])
    const id = taskIds()[0] as string
    expect(await runCli(['tasks', 'update', ...repo, '--id', id, '--title', 'Ship it well'])).toBe(
      `Updated Task ${id}`,
    )
    expect(await runCli(['tasks', 'done', ...repo, '--id', id])).toBe(`Marked Task ${id} done`)
    expect(await runCli(['tasks', 'list', ...repo])).toContain('(done) Ship it well')
    expect(await runCli(['tasks', 'done', ...repo, '--id', 'no-such-task'])).toContain('No Task')
  })

  it('tasks add rejects an unknown status', async () => {
    await expect(
      runCli(['tasks', 'add', ...repo, '--title', 'Bad', '--status', 'backlog']),
    ).rejects.toThrow(/todo\|doing\|done\|blocked/)
  })

  it('tasks get prints the short id, notes, and a tagged file', async () => {
    const created = await runCli([
      'tasks',
      'add',
      ...repo,
      '--title',
      'Look at app.ts',
      '--notes',
      'The probe is flaky',
      '--project-id',
      'proj-1',
      '--worktree-id',
      'wt-1',
      '--file',
      'src/app.ts',
    ])
    expect(created).toContain('T-1')
    const shown = await runCli(['tasks', 'get', ...repo, '--id', 'T-1'])
    expect(shown).toContain('T-1  Look at app.ts')
    expect(shown).toContain('The probe is flaky')
    expect(shown).toContain('file: src/app.ts')
  })

  it('tasks --help documents the verbs and the noun-specific flags', async () => {
    const text = await runCli(['tasks', '--help'])
    expect(text).toContain('--attach')
    expect(text).toContain("Absolute path to a file copied into the daemon's Task attachment store")
    expect(text).toContain('Print one Task (UUID or T-18)')
    expect(text).toContain('--file')
  })
})
