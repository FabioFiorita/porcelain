import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import {
  type ActionWhere,
  createAction,
  deleteAction,
  describeActions,
  readActions,
  updateAction,
} from './action-file'
import {
  CANVAS_COMMANDS,
  describeCanvases,
  describePromoteCanvas,
  describeSetCanvas,
  listCanvasesForRepo,
} from './canvas-file'
import { describePromoteOverrides, PROJECT_COMMANDS } from './overlay-file'
import {
  clearWorktreeProfile,
  describeProjectProfile,
  describeWorktreeProfile,
  PROFILE_COMMANDS,
  setProjectProfile,
  setWorktreeProfile,
  toProjectProfile,
  toWorktreeProfile,
  WORKTREE_COMMANDS,
} from './profile-file'
import {
  addReviewFiles,
  clearReviewCanvas,
  describeReview,
  type ReviewSet,
  readReview,
  setReviewCanvas,
  toReviewFiles,
  toReviewSections,
} from './review-file'
import { describeTasksCommand } from './tasks-describe'
import { TASKS_COMMANDS } from './tasks-file'

// Porcelain's agent CLI writes daemon-root Project data (Tasks, Actions, and Review
// Canvases). One fresh process per invocation does a single synchronous read-modify-write.
// Node builtins only; the built bundle is installed to ~/.porcelain/porcelain.js and run under
// plain `node`.

interface CliDeps {
  /** Directory to resolve the repo from when --repo is absent. Default: process.cwd(). */
  cwd?: string
  /** Reads all of stdin (for the `-` sentinel on --files/--sections). Mockable. */
  readStdin?: () => string
}

const BOOLEAN_FLAGS = new Set(['help', 'version', 'tracked', 'dry-run'])

interface ParsedArgs {
  positionals: string[]
  flags: Map<string, string>
}

/**
 * Hand-rolled getopt: bare tokens are positionals (noun, verb); `--name value` pairs
 * become flags. A value-taking flag with no following value (end of argv or another
 * `--flag` next) is recorded present-but-empty, so a required-flag check still fails.
 */
function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  const flags = new Map<string, string>()
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === undefined) continue
    if (token.startsWith('--')) {
      const name = token.slice(2)
      if (BOOLEAN_FLAGS.has(name)) {
        flags.set(name, '')
        continue
      }
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(name, next)
        i++
      } else {
        flags.set(name, '')
      }
    } else {
      positionals.push(token)
    }
  }
  return { positionals, flags }
}

function defaultReadStdin(): string {
  return readFileSync(0, 'utf8')
}

/** --repo (absolute) if given, else the git worktree root containing the cwd. */
function resolveRepo(flags: Map<string, string>, cwd: string): string {
  const repoFlag = flags.get('repo')
  if (repoFlag !== undefined && repoFlag !== '') {
    // Channels are keyed by absolute repo path; a relative --repo would silently write
    // under a key the app never reads back. Reject it up front.
    if (!isAbsolute(repoFlag)) throw new Error('--repo must be an absolute path')
    return repoFlag
  }
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim()
  } catch {
    throw new Error('not inside a git repository — pass --repo <absolute path>')
  }
}

/** `primary` | `local`, or undefined when the flag is absent. */
function parseActionWhere(raw: string | undefined): ActionWhere | undefined {
  if (raw === undefined || raw === '') return undefined
  if (raw === 'primary' || raw === 'local') return raw
  throw new Error('where must be one of primary|local')
}

const FLAG_DESCRIPTIONS: Record<string, string> = {
  repo: 'Absolute repo path (default: the git repo containing the current directory)',
  name: 'Review name shown in Porcelain (default "Active review")',
  files:
    "Review files as JSON: array of {path, source?: changed|context|shipped, note?, layer?}, in flow order (entry point → data); '-' reads stdin",
  thesis: 'One-paragraph markdown thesis shown at the top of the Review',
  sections:
    "Walkthrough sections as JSON: array of {title, prose (markdown), diagram? (inline SVG), anchors?: [{path, startLine?, endLine?}]}, in flow order; '-' reads stdin",
  title: 'Short title for the item',
  body: 'Body / details text',
  id: 'The item id (from the matching list/get command)',
  status: 'Column: todo | doing | done',
  command: 'The shell command to run',
  where:
    "Where the human's click runs the command: primary (this window's machine, default) | local (This device, when the window is remote)",
  path: 'Repo-relative folder or file path (absolute under the repo also accepted)',
  kind: 'Canvas kind: html | markdown',
  'source-dir':
    'Absolute path to a local directory holding the Canvas entry file and its siblings (images, CSS, JS) — copied wholesale into the bundle',
  entry:
    'Entry file name inside --source-dir (default: index.html for html, index.md for markdown)',
  profile:
    "Whole profile document as JSON, or '-' to read it from stdin — the level is replaced, never merged",
}

interface VerbHelp {
  verb: string
  args: string
  desc: string
}

interface NounHelp {
  noun: string
  blurb: string
  verbs: VerbHelp[]
  /** Flags whose descriptions are shown under `porcelain <noun> --help`. */
  flags: string[]
  /** Per-noun descriptions that override the shared FLAG_DESCRIPTIONS. */
  flagOverrides?: Record<string, string>
}

/**
 * The help registry. This and the dispatch `switch` below are two hand-maintained lists of
 * the same command set; `cli.test.ts` fails if they ever disagree, because a verb that is
 * documented but undispatched (or the reverse) is invisible until an agent hits it.
 */
export const COMMANDS: NounHelp[] = [
  {
    noun: 'review',
    blurb: 'the review set (the files and walkthrough that make up the Review)',
    verbs: [
      {
        verb: 'set',
        args: '[--name <s>] [--thesis <s>] [--files <json|->] [--sections <json|->]',
        desc: 'Replace the review set (name + thesis alone is a valid Intent-first start)',
      },
      { verb: 'add', args: '--files <json|->', desc: 'Add files to the existing set' },
      { verb: 'get', args: '', desc: 'Read back the declared set' },
      {
        verb: 'clear',
        args: '',
        desc: 'Remove the daemon-root Review Canvas',
      },
    ],
    flags: ['name', 'thesis', 'files', 'sections'],
  },
  TASKS_COMMANDS,
  {
    noun: 'actions',
    blurb:
      'saved actions — named shell commands the human runs in the terminal; daemon-root, outlives the checkout',
    verbs: [
      { verb: 'list', args: '', desc: 'List saved actions' },
      {
        verb: 'create',
        args: '--title <s> --command <s> [--where primary|local]',
        desc: 'Add an action',
      },
      {
        verb: 'update',
        args: '--id <s> [--title <s>] [--command <s>] [--where primary|local]',
        desc: "Edit an action's fields",
      },
      { verb: 'delete', args: '--id <s>', desc: 'Remove an action' },
    ],
    flags: ['title', 'command', 'where', 'id'],
  },
  CANVAS_COMMANDS,
  PROJECT_COMMANDS,
  PROFILE_COMMANDS,
  WORKTREE_COMMANDS,
]

const HEADER = "porcelain — read and write Porcelain's agent channels for a repo"
const GLOBAL_HELP = `Usage:
  porcelain <noun> <verb> [flags]
  porcelain <noun> --help
  porcelain --version

Every command resolves a repo (--repo <abs path>, else the git repo containing the
current directory). Flags marked <json|-> or <s|-> accept '-' to read stdin.`

function renderVerbs(noun: NounHelp): string {
  const width = Math.max(...noun.verbs.map((v) => v.verb.length))
  return noun.verbs
    .map((v) => {
      const head = `  ${v.verb.padEnd(width)}  ${v.desc}`
      return v.args ? `${head}\n      ${v.args}` : head
    })
    .join('\n')
}

function renderHelp(nounName?: string): string {
  const noun = nounName ? COMMANDS.find((c) => c.noun === nounName) : undefined
  if (noun) {
    const flagLines = ['repo', ...noun.flags]
      .map((f) => `  --${f.padEnd(11)} ${noun.flagOverrides?.[f] ?? FLAG_DESCRIPTIONS[f]}`)
      .join('\n')
    return `${HEADER}\n\nporcelain ${noun.noun} <verb> — ${noun.blurb}\n\n${renderVerbs(noun)}\n\nFlags:\n${flagLines}`
  }
  const sections = COMMANDS.map((c) => `${c.noun} — ${c.blurb}\n${renderVerbs(c)}`).join('\n\n')
  return `${HEADER}\n\n${GLOBAL_HELP}\n\n${sections}`
}

/**
 * Run one CLI invocation and return the output string (throws on error).
 * Parse flags, resolve the repo, run one channel op.
 */
export async function runCli(argv: string[], deps: CliDeps = {}): Promise<string> {
  const cwd = deps.cwd ?? process.cwd()
  const readStdin = deps.readStdin ?? defaultReadStdin
  const { positionals, flags } = parseArgs(argv)

  if (flags.has('version')) return __PORCELAIN_VERSION__
  const noun = positionals[0]
  const verb = positionals[1]
  if (noun === undefined) return renderHelp()
  if (noun === 'help') return renderHelp(verb)
  if (flags.has('help') || verb === undefined) return renderHelp(noun)
  // `worktree` is the one noun with a two-word verb (`profile get`), because the
  // level it addresses needs naming: `porcelain profile` is the project.
  const command = noun === 'worktree' ? positionals.slice(0, 3).join(' ') : `${noun} ${verb}`
  if (noun === 'worktree' && positionals[2] === undefined) return renderHelp(noun)

  const req = (name: string): string => {
    const value = flags.get(name)
    if (value === undefined || value === '') throw new Error(`${name} is required`)
    return value
  }
  const opt = (name: string): string | undefined => flags.get(name)
  /** `a.md, b.html` → ['a.md','b.html']; absent → undefined, so "unset" survives. */
  const splitList = (raw: string | undefined): string[] | undefined =>
    raw === undefined
      ? undefined
      : raw
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry !== '')
  const readJson = (name: string): unknown => {
    const raw = flags.get(name)
    if (raw === undefined) return undefined
    return JSON.parse(raw === '-' ? readStdin() : raw)
  }
  const repo = resolveRepo(flags, cwd)

  switch (command) {
    case 'review set': {
      const name = opt('name') ?? 'Active review'
      // Intent-first starts declare a name and a thesis before any file is touched, so
      // --files is optional and defaults to empty. Passing it explicitly still validates.
      const rawFiles = readJson('files')
      const files = rawFiles === undefined ? [] : toReviewFiles(rawFiles)
      const rawSections = readJson('sections')
      const sections = rawSections === undefined ? [] : toReviewSections(rawSections)
      const set: ReviewSet = { name, files, sections }
      const thesis = opt('thesis')
      if (thesis !== undefined && thesis !== '') set.thesis = thesis
      setReviewCanvas(repo, set)
      const extras = sections.length > 0 ? `, ${sections.length} section(s)` : ''
      return `Set review "${name}" (${files.length} files${extras}) for ${repo}`
    }
    case 'review add': {
      const files = toReviewFiles(readJson('files'))
      const total = addReviewFiles(repo, files)
      return `Added ${files.length} file(s); the review now has ${total} for ${repo}`
    }
    case 'review get':
      return describeReview(repo, readReview(repo))
    case 'review clear':
      clearReviewCanvas(repo)
      return `Cleared the Review Canvas for ${repo}`
    case 'tasks list':
    case 'tasks add':
    case 'tasks get':
    case 'tasks update':
    case 'tasks done':
      return describeTasksCommand(verb, repo, flags)
    case 'actions list':
      return describeActions(repo, readActions(repo))
    case 'actions create': {
      const title = req('title')
      const command = req('command')
      const action = createAction(repo, title, command, parseActionWhere(opt('where')))
      return `Created action ${action.id} "${title}" for ${repo}`
    }
    case 'actions update': {
      const id = req('id')
      const found = updateAction(repo, id, {
        title: opt('title'),
        command: opt('command'),
        where: parseActionWhere(opt('where')),
      })
      return found ? `Updated action ${id} for ${repo}` : `No action ${id} for ${repo}`
    }
    case 'actions delete': {
      const id = req('id')
      return deleteAction(repo, id)
        ? `Deleted action ${id} for ${repo}`
        : `No action ${id} for ${repo}`
    }
    case 'canvas list':
      return describeCanvases(listCanvasesForRepo(repo))
    case 'canvas set':
      return describeSetCanvas(repo, {
        title: req('title'),
        kind: req('kind'),
        sourceDir: req('source-dir'),
        entryFile: opt('entry'),
        id: opt('id'),
        tracked: flags.has('tracked'),
      })
    case 'canvas promote':
      return describePromoteCanvas(repo, { id: req('id'), worktree: opt('worktree') })
    case 'project promote-overrides':
      return describePromoteOverrides(repo, {
        hidden: splitList(opt('hidden')),
        pinned: splitList(opt('pinned')),
      })
    case 'profile get':
      return describeProjectProfile(repo)
    case 'profile set':
      setProjectProfile(repo, toProjectProfile(readJson('profile')))
      return describeProjectProfile(repo)
    case 'worktree profile get':
      return describeWorktreeProfile(repo)
    case 'worktree profile set':
      setWorktreeProfile(repo, toWorktreeProfile(readJson('profile')))
      return describeWorktreeProfile(repo)
    case 'worktree profile clear':
      clearWorktreeProfile(repo)
      return describeWorktreeProfile(repo)
    default:
      throw new Error(`unknown command: "${command}" — try "porcelain help"`)
  }
}
