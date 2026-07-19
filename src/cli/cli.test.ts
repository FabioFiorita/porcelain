import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from './cli'

const dir = join(tmpdir(), 'porcelain-cli-test')
const file = join(dir, 'review-sets.json')
const notesFile = join(dir, 'notes.json')
const layersFile = join(dir, 'layers.json')
const reviewedFile = join(dir, 'reviewed.json')
const boardFile = join(dir, 'board.json')
const actionsFile = join(dir, 'actions.json')
const commentsFile = join(dir, 'comments.json')
const featureViewFile = join(dir, 'feature-view.json')
const evidenceFile = join(dir, 'evidence.json')
const chatFile = join(dir, 'chat.json')

beforeEach(() => {
  process.env.PORCELAIN_REVIEW_SETS = file
  process.env.PORCELAIN_EVIDENCE = evidenceFile
  process.env.PORCELAIN_NOTES = notesFile
  process.env.PORCELAIN_LAYERS = layersFile
  process.env.PORCELAIN_REVIEWED = reviewedFile
  process.env.PORCELAIN_BOARD = boardFile
  process.env.PORCELAIN_ACTIONS = actionsFile
  process.env.PORCELAIN_COMMENTS = commentsFile
  process.env.PORCELAIN_FEATURE_VIEW = featureViewFile
  process.env.PORCELAIN_CHAT = chatFile
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_REVIEW_SETS
  delete process.env.PORCELAIN_NOTES
  delete process.env.PORCELAIN_LAYERS
  delete process.env.PORCELAIN_REVIEWED
  delete process.env.PORCELAIN_BOARD
  delete process.env.PORCELAIN_ACTIONS
  delete process.env.PORCELAIN_COMMENTS
  delete process.env.PORCELAIN_FEATURE_VIEW
  delete process.env.PORCELAIN_EVIDENCE
  delete process.env.PORCELAIN_LOOP_EVIDENCE_DIR
  delete process.env.PORCELAIN_CHAT
  rmSync(dir, { recursive: true, force: true })
})
// A plausible self-contained document: has a `<` tag and clears the MIN_HTML_BYTES floor,
// so it survives resolveToolHtml's plausibility guard (unlike tiny test fragments).
const doc = `<main>${'x'.repeat(600)}</main>`

// Every command targets --repo /repo unless it's exercising repo resolution itself.
const repo = ['--repo', '/repo']

const read = (): Record<
  string,
  { name: string; thesis?: string; files: unknown[]; sections?: unknown[] }
> => JSON.parse(readFileSync(file, 'utf8'))
const readBoard = (): Record<string, unknown[]> => JSON.parse(readFileSync(boardFile, 'utf8'))
const readActions = (): Record<string, unknown[]> => JSON.parse(readFileSync(actionsFile, 'utf8'))

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
    const readStdin = () => JSON.stringify([{ path: 'a.ts' }])
    await runCli(['review', 'set', ...repo, '--files', '-'], { readStdin })
    expect(read()['/repo']?.files).toEqual([{ path: 'a.ts' }])
  })
  it('reads --layers from stdin when passed "-"', async () => {
    const readStdin = () => JSON.stringify([{ label: 'Pages', pattern: '(^|/)pages/' }])
    await runCli(['layers', 'set', ...repo, '--layers', '-'], { readStdin })
    expect(await runCli(['layers', 'get', ...repo])).toContain('Pages')
  })
  it('reads --html from stdin when passed "-"', async () => {
    process.env.PORCELAIN_LOOP_EVIDENCE_DIR = join(dir, 'loop-evidence')
    const readStdin = () => doc
    await runCli(['evidence', 'set', ...repo, '--title', 'Piped', '--html', '-'], { readStdin })
    expect(await runCli(['evidence', 'get', ...repo])).toContain('Loop evidence "Piped" for /repo')
  })
})

describe('runCli — review + feature + comments + reviewed', () => {
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
    expect(read()['/repo']).toEqual({ name: 'X', files: [{ path: 'a.ts' }], sections: [] })
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
    expect(read()['/repo']?.thesis).toBe('One round-trip instead of three.')
    expect(read()['/repo']?.sections).toEqual(sections)
    const text = await runCli(['review', 'get', ...repo])
    expect(text).toContain('1 section(s), thesis set')
    expect(JSON.parse(text.slice(text.indexOf('{')))).toEqual({
      thesis: 'One round-trip instead of three.',
      files: [{ path: 'a.ts' }],
      sections,
    })
  })
  it('review set reads --sections from stdin when passed "-"', async () => {
    const readStdin = () => JSON.stringify([{ title: 'Entry', prose: 'piped' }])
    await runCli(
      ['review', 'set', ...repo, '--files', JSON.stringify([{ path: 'a.ts' }]), '--sections', '-'],
      { readStdin },
    )
    expect(read()['/repo']?.sections).toEqual([{ title: 'Entry', prose: 'piped', anchors: [] }])
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
    expect(read()['/repo']?.thesis).toBe('The why.')
    expect(read()['/repo']?.sections).toHaveLength(1)
    expect(read()['/repo']?.files).toHaveLength(2)
  })
  it('review set defaults the name to "Feature view"', async () => {
    await runCli(['review', 'set', ...repo, '--files', JSON.stringify([{ path: 'a.ts' }])])
    expect(read()['/repo']?.name).toBe('Feature view')
  })
  it('review set requires --files', async () => {
    await expect(runCli(['review', 'set', ...repo])).rejects.toThrow('files must be an array')
  })
  it('review add merges into the existing set', async () => {
    await runCli(['review', 'set', ...repo, '--files', JSON.stringify([{ path: 'a.ts' }])])
    await runCli(['review', 'add', ...repo, '--files', JSON.stringify([{ path: 'b.ts' }])])
    expect(read()['/repo']?.files).toEqual([{ path: 'a.ts' }, { path: 'b.ts' }])
  })
  it('review clear removes the set', async () => {
    await runCli(['review', 'set', ...repo, '--files', JSON.stringify([{ path: 'a.ts' }])])
    await runCli(['review', 'clear', ...repo])
    expect(read()['/repo']).toBeUndefined()
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
    expect(await runCli(['review', 'get', ...repo])).toContain('Feature review "X" for /repo')
  })
  it('feature get describes the app-computed snapshot, or hints when absent', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      featureViewFile,
      JSON.stringify({
        '/repo': { name: 'X', files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }] },
      }),
    )
    expect(await runCli(['feature', 'get', ...repo])).toContain('Feature view "X" for /repo')
    expect(await runCli(['feature', 'get', '--repo', '/other'])).toContain(
      'No feature view computed',
    )
  })
  it('comments list tags each comment with its feature-view source', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      commentsFile,
      JSON.stringify({
        '/repo': [
          { id: 'c1', path: 'server/svc.ts', body: 'check', resolved: false, createdAt: 1 },
        ],
      }),
    )
    writeFileSync(
      featureViewFile,
      JSON.stringify({
        '/repo': { name: 'X', files: [{ path: 'server/svc.ts', source: 'shipped', layer: 'Svc' }] },
      }),
    )
    expect(await runCli(['comments', 'list', ...repo])).toContain('[c1] server/svc.ts (shipped)')
  })
  it('comments answer attaches a reply, found/not-found by id', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      commentsFile,
      JSON.stringify({
        '/repo': [{ id: 'c1', path: 'a.ts', body: 'why?', resolved: false, createdAt: 1 }],
      }),
    )
    expect(
      await runCli(['comments', 'answer', ...repo, '--id', 'c1', '--body', 'because']),
    ).toContain('Answered comment c1')
    const stored: Record<string, Array<{ agentReply?: { body: string } }>> = JSON.parse(
      readFileSync(commentsFile, 'utf8'),
    )
    expect(stored['/repo']?.[0]?.agentReply?.body).toBe('because')
    expect(await runCli(['comments', 'answer', ...repo, '--id', 'nope', '--body', 'x'])).toContain(
      'No comment nope',
    )
  })
  it('comments answer requires id and body', async () => {
    await expect(runCli(['comments', 'answer', ...repo, '--body', 'x'])).rejects.toThrow(
      'id is required',
    )
    await expect(runCli(['comments', 'answer', ...repo, '--id', 'c1'])).rejects.toThrow(
      'body is required',
    )
  })
  it('reviewed list lists the human-reviewed paths', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(reviewedFile, JSON.stringify({ '/repo': ['src/a.ts', 'src/b.ts'] }))
    const text = await runCli(['reviewed', 'list', ...repo])
    expect(text).toContain('src/a.ts')
    expect(text).toContain('src/b.ts')
    expect(await runCli(['reviewed', 'list', '--repo', '/other'])).toContain(
      'No files marked reviewed',
    )
  })
})

describe('runCli — evidence (html input)', () => {
  it('evidence set rejects both --html and --html-file', async () => {
    process.env.PORCELAIN_LOOP_EVIDENCE_DIR = join(dir, 'loop-evidence')
    mkdirSync(dir, { recursive: true })
    const htmlPath = join(dir, 'evidence.html')
    writeFileSync(htmlPath, doc)
    await expect(
      runCli(['evidence', 'set', ...repo, '--title', 'X', '--html', doc, '--html-file', htmlPath]),
    ).rejects.toThrow('not both')
  })
  it('evidence set rejects neither --html nor --html-file', async () => {
    process.env.PORCELAIN_LOOP_EVIDENCE_DIR = join(dir, 'loop-evidence')
    await expect(runCli(['evidence', 'set', ...repo, '--title', 'X'])).rejects.toThrow(
      '--html or --html-file is required',
    )
  })

  it('evidence prepare prepares the on-disk directory', async () => {
    process.env.PORCELAIN_LOOP_EVIDENCE_DIR = join(dir, 'loop-evidence')
    const msg = await runCli(['evidence', 'prepare', ...repo, '--title', 'SPA redirect'])
    expect(msg).toContain('Loop evidence directory ready')
    expect(msg).toContain('index.html')
    expect(msg).toMatch(/loop-evidence/)
  })
  it('evidence prepare rejects a missing title', async () => {
    process.env.PORCELAIN_LOOP_EVIDENCE_DIR = join(dir, 'loop-evidence')
    await expect(runCli(['evidence', 'prepare', ...repo])).rejects.toThrow(
      'title must be a non-empty string',
    )
  })
  it('evidence set/get/clear with html writes index.html under the dir', async () => {
    process.env.PORCELAIN_LOOP_EVIDENCE_DIR = join(dir, 'loop-evidence')
    await runCli(['evidence', 'set', ...repo, '--title', 'Vite loop', '--html', doc])
    expect(await runCli(['evidence', 'get', ...repo])).toContain(
      'Loop evidence "Vite loop" for /repo',
    )
    expect(await runCli(['evidence', 'get', ...repo])).toContain('index.html')
    await runCli(['evidence', 'clear', ...repo])
    expect(await runCli(['evidence', 'get', ...repo])).toContain('No loop evidence')
  })
  it('evidence set rejects a missing title', async () => {
    process.env.PORCELAIN_LOOP_EVIDENCE_DIR = join(dir, 'loop-evidence')
    await expect(runCli(['evidence', 'set', ...repo, '--html', doc])).rejects.toThrow(
      'title must be a non-empty string',
    )
  })
  it('evidence set rejects a file path pasted into --html', async () => {
    process.env.PORCELAIN_LOOP_EVIDENCE_DIR = join(dir, 'loop-evidence')
    await expect(
      runCli([
        'evidence',
        'set',
        ...repo,
        '--title',
        'Redirect',
        '--html',
        'filePath:/tmp/x/loop.html',
      ]),
    ).rejects.toThrow(/html-file/)
  })
  it('evidence set rejects a missing --html-file', async () => {
    process.env.PORCELAIN_LOOP_EVIDENCE_DIR = join(dir, 'loop-evidence')
    await expect(
      runCli([
        'evidence',
        'set',
        ...repo,
        '--title',
        'Redirect',
        '--html-file',
        join(dir, 'nope.html'),
      ]),
    ).rejects.toThrow('not found or unreadable')
  })
  it('evidence get includes a content preview of what was stored', async () => {
    process.env.PORCELAIN_LOOP_EVIDENCE_DIR = join(dir, 'loop-evidence')
    await runCli([
      'evidence',
      'set',
      ...repo,
      '--title',
      'Vite loop',
      '--html',
      `<h1>Marker heading</h1>${'x'.repeat(600)}`,
    ])
    const text = await runCli(['evidence', 'get', ...repo])
    expect(text).toContain('Preview:')
    expect(text).toContain('Marker heading')
  })
  it('evidence set accepts --html-file and writes the evidence dir', async () => {
    process.env.PORCELAIN_LOOP_EVIDENCE_DIR = join(dir, 'loop-evidence')
    mkdirSync(dir, { recursive: true })
    const htmlPath = join(dir, 'evidence.html')
    writeFileSync(htmlPath, doc)
    const msg = await runCli([
      'evidence',
      'set',
      ...repo,
      '--title',
      'Disk evidence',
      '--html-file',
      htmlPath,
    ])
    expect(msg).toContain('index.html')
    expect(await runCli(['evidence', 'get', ...repo])).toContain('Disk evidence')
  })
})

describe('runCli — notes + layers', () => {
  it('notes get reads the human notes scratchpad', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(notesFile, JSON.stringify({ '/repo': '# conventions\n- no any' }))
    expect(await runCli(['notes', 'get', ...repo])).toContain('# conventions')
    expect(await runCli(['notes', 'get', '--repo', '/other'])).toContain('No project notes')
  })
  it('layers get shows the defaults when none are custom', async () => {
    expect(await runCli(['layers', 'get', ...repo])).toContain('built-in defaults')
  })
  it('layers set writes a repo-keyed ordered set', async () => {
    await runCli([
      'layers',
      'set',
      ...repo,
      '--layers',
      JSON.stringify([{ label: 'Pages', pattern: '(^|/)pages/' }]),
    ])
    const text = await runCli(['layers', 'get', ...repo])
    expect(text).toContain('Custom flow layers')
    expect(text).toContain('Pages')
  })
  it('layers set rejects an invalid regex', async () => {
    await expect(
      runCli([
        'layers',
        'set',
        ...repo,
        '--layers',
        JSON.stringify([{ label: 'Bad', pattern: '(' }]),
      ]),
    ).rejects.toThrow('valid regular expression')
  })
  it('layers reset drops the custom set', async () => {
    await runCli([
      'layers',
      'set',
      ...repo,
      '--layers',
      JSON.stringify([{ label: 'Pages', pattern: '(^|/)pages/' }]),
    ])
    await runCli(['layers', 'reset', ...repo])
    expect(await runCli(['layers', 'get', ...repo])).toContain('built-in defaults')
  })
})

describe('runCli — board + chat + actions', () => {
  it('board create with a title writes a card in todo by default', async () => {
    await runCli(['board', 'create', ...repo, '--title', 'Ship it'])
    const cards = readBoard()['/repo'] as Array<{ title: string; status: string }>
    expect(cards).toHaveLength(1)
    expect(cards[0]?.title).toBe('Ship it')
    expect(cards[0]?.status).toBe('todo')
  })
  it('board create without --title rejects with "title is required"', async () => {
    await expect(runCli(['board', 'create', ...repo])).rejects.toThrow('title is required')
  })
  it('board update edits the title and body of an existing card', async () => {
    await runCli(['board', 'create', ...repo, '--title', 'Old'])
    const id = (readBoard()['/repo'] as Array<{ id: string }>)[0]?.id as string
    const result = await runCli([
      'board',
      'update',
      ...repo,
      '--id',
      id,
      '--title',
      'New',
      '--body',
      'detail',
    ])
    expect(result).toContain('Updated card')
    const cards = readBoard()['/repo'] as Array<{ title: string; body: string }>
    expect(cards[0]?.title).toBe('New')
    expect(cards[0]?.body).toBe('detail')
  })
  it('board move to a valid status moves it', async () => {
    await runCli(['board', 'create', ...repo, '--title', 'Task'])
    const id = (readBoard()['/repo'] as Array<{ id: string }>)[0]?.id as string
    const result = await runCli(['board', 'move', ...repo, '--id', id, '--status', 'doing'])
    expect(result).toContain('Moved card')
    expect((readBoard()['/repo'] as Array<{ status: string }>)[0]?.status).toBe('doing')
  })
  it('board move with a bad status rejects', async () => {
    await runCli(['board', 'create', ...repo, '--title', 'Task'])
    const id = (readBoard()['/repo'] as Array<{ id: string }>)[0]?.id as string
    await expect(
      runCli(['board', 'move', ...repo, '--id', id, '--status', 'invalid']),
    ).rejects.toThrow('status must be one of todo|doing|done')
  })
  it('board move for a missing id returns the "No card" string without throwing', async () => {
    const result = await runCli([
      'board',
      'move',
      ...repo,
      '--id',
      'no-such-id',
      '--status',
      'done',
    ])
    expect(result).toContain('No card')
  })
  it('board delete removes the card', async () => {
    await runCli(['board', 'create', ...repo, '--title', 'Gone'])
    const id = (readBoard()['/repo'] as Array<{ id: string }>)[0]?.id as string
    const result = await runCli(['board', 'delete', ...repo, '--id', id])
    expect(result).toContain('Deleted card')
    expect((readBoard()['/repo'] as unknown[]).length).toBe(0)
  })
  it('board list groups by column', async () => {
    await runCli(['board', 'create', ...repo, '--title', 'Task'])
    expect(await runCli(['board', 'list', ...repo])).toContain('Task')
  })
  it('chat post + list round-trip', async () => {
    await runCli(['chat', 'post', ...repo, '--from', 'local', '--body', 'need sim shot'])
    const text = await runCli(['chat', 'list', ...repo])
    expect(text).toContain('local')
    expect(text).toContain('need sim shot')
  })
  it('chat clear empties the thread', async () => {
    await runCli(['chat', 'post', ...repo, '--from', 'a', '--body', 'b'])
    await runCli(['chat', 'clear', ...repo])
    expect(await runCli(['chat', 'list', ...repo])).toContain('is empty')
  })
  it('chat post --files declares a claim (body optional, synthesized)', async () => {
    const out = await runCli([
      'chat',
      'post',
      ...repo,
      '--from',
      'alice',
      '--files',
      'auth.ts, session.ts',
      '--intent',
      'wiring login',
    ])
    expect(out).toContain('Posted claim')
    expect(out).toContain('2 file(s)')
    const list = await runCli(['chat', 'list', ...repo])
    expect(list).toContain('[CLAIM]')
    expect(list).toContain('files: auth.ts, session.ts')
  })
  it('chat list surfaces an overlap between two agents claims', async () => {
    await runCli(['chat', 'post', ...repo, '--from', 'alice', '--files', 'session.ts'])
    await runCli(['chat', 'post', ...repo, '--from', 'bob', '--files', 'session.ts'])
    const list = await runCli(['chat', 'list', ...repo])
    expect(list).toContain('⚠ Overlap: alice & bob both touching session.ts')
  })
  it('chat post --closes retires the claim and needs no --body', async () => {
    await runCli(['chat', 'post', ...repo, '--from', 'alice', '--files', 'auth.ts'])
    await runCli(['chat', 'post', ...repo, '--from', 'alice', '--closes'])
    const list = await runCli(['chat', 'list', ...repo])
    expect(list).toContain('[CLOSED]')
    expect(list).not.toContain('Live claims')
  })
  it('chat post with no body and no claim still requires a body', async () => {
    await expect(runCli(['chat', 'post', ...repo, '--from', 'alice'])).rejects.toThrow(
      'body is required',
    )
  })
  it('actions create with title+command writes an action', async () => {
    await runCli(['actions', 'create', ...repo, '--title', 'Dev', '--command', 'pnpm dev'])
    const actions = readActions()['/repo'] as Array<{ title: string; command: string }>
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
    const id = (readActions()['/repo'] as Array<{ id: string }>)[0]?.id as string
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
    const actions = readActions()['/repo'] as Array<{ title: string; command: string }>
    expect(actions[0]?.title).toBe('Build')
    expect(actions[0]?.command).toBe('pnpm build')
  })
  it('actions delete removes the action', async () => {
    await runCli(['actions', 'create', ...repo, '--title', 'Dev', '--command', 'pnpm dev'])
    const id = (readActions()['/repo'] as Array<{ id: string }>)[0]?.id as string
    const result = await runCli(['actions', 'delete', ...repo, '--id', id])
    expect(result).toContain('Deleted action')
    expect((readActions()['/repo'] as unknown[]).length).toBe(0)
  })
})
