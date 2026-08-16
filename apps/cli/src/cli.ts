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
import { readActiveReviewSnapshot, sourceByPath } from './active-review-file'
import {
  createCard,
  deleteCard,
  describeBoard,
  moveCard,
  normalizeStatus,
  readCards,
  updateCard,
} from './board-file'
import {
  CANVAS_COMMANDS,
  describeCanvases,
  describePromoteCanvas,
  describeSetCanvas,
  listCanvasesForRepo,
} from './canvas-file'
import { answerComment, describeComments, readComments, resolveComment } from './comment-file'
import {
  checkEvidence,
  clearEvidence,
  describeAssets,
  describeEvidence,
  MAX_HTML_BYTES as EVIDENCE_MAX_HTML_BYTES,
  evidenceOverallStatus,
  getEvidence,
  listResults,
  orderResults,
  prepareEvidence,
  setEvidence,
} from './evidence-file'
import { resolveToolHtml } from './html-input'
import { describePrepareIntent, listIntent, orderIntent } from './intent-file'
import { clearLayers, describeLayers, readLayers, setLayers, toLayers } from './layers-file'
import { describeMigrate, MIGRATE_COMMANDS } from './migrate-file'
import { describeNotes, readNotes } from './notes-file'
import { describePromoteOverrides, PROJECT_COMMANDS } from './overlay-file'
import {
  addReviewFiles,
  clearReview,
  clearReviewCanvas,
  describeReview,
  type ReviewSet,
  readReview,
  setReviewCanvas,
  toReviewFiles,
  toReviewSections,
} from './review-file'
import { describeReviewed, readReviewed } from './reviewed-file'
import {
  clearScope,
  describeScope,
  hidePath as hideScopePath,
  pinPath as pinScopePath,
  readScope,
  unhidePath as unhideScopePath,
  unpinPath as unpinScopePath,
} from './scope-file'
import { describeTasksCommand, TASKS_COMMANDS } from './tasks-file'

// Porcelain's agent CLI: a dependency-free command that reads and writes project
// companion channels under <repo>/.porcelain/ (review, board, actions, notes, layers,
// evidence, comments, reviewed marks, scope) — plus Canvas, the one noun that instead
// writes the daemon-root Project store under $PORCELAIN_HOME (ADR 0002), since Canvases
// outlive the checkout that authored them. One fresh process per invocation does a
// single synchronous read-modify-write. Node builtins only; the built bundle is
// installed to ~/.porcelain/porcelain.js and run under plain `node`.

interface CliDeps {
  /** Directory to resolve the repo from when --repo is absent. Default: process.cwd(). */
  cwd?: string
  /** Reads all of stdin (for the `-` sentinel on --files/--layers/--html). Mockable. */
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
  medium: 'Canvas medium — html is the only one',
  html: "The complete self-contained HTML document, inline; '-' reads stdin",
  'html-file':
    'Absolute path to a local HTML file to read (prefer over --html for large docs with embedded screenshots)',
  id: 'The item id (from the matching list/get command)',
  status: 'Column: todo | doing | done',
  command: 'The shell command to run',
  where:
    "Where the human's click runs the command: primary (this window's machine, default) | local (This device, when the window is remote)",
  layers:
    "Flow layers as JSON: array of {label, pattern} in order (entry point → data); '-' reads stdin",
  path: 'Repo-relative folder or file path (absolute under the repo also accepted)',
  label: 'Short label for the verification check, e.g. "pnpm test"',
  detail: 'Optional result detail for the check, e.g. "1348 passed"',
  tabs: 'Comma-separated starting tabs (default: why,approach,decisions); a bare name gets .md',
  kind: 'Canvas kind: html | markdown',
  'source-dir':
    'Absolute path to a local directory holding the Canvas entry file and its siblings (images, CSS, JS) — copied wholesale into the bundle',
  entry:
    'Entry file name inside --source-dir (default: index.html for html, index.md for markdown)',
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
  /**
   * Per-noun descriptions that override the shared FLAG_DESCRIPTIONS — for a flag whose
   * meaning differs by noun (e.g. evidence's `--status` is a check result, board's a column).
   */
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
        desc: 'Clear the Review and loop evidence (set + on-disk HTML/images) — matches the app Clear button',
      },
    ],
    flags: ['name', 'thesis', 'files', 'sections', 'html', 'html-file'],
  },
  {
    noun: 'comments',
    blurb: "the human reviewer's line/file comments",
    verbs: [
      { verb: 'list', args: '', desc: 'List open comments, tagged with active-review source' },
      { verb: 'resolve', args: '--id <s>', desc: 'Mark a comment resolved' },
      { verb: 'answer', args: '--id <s> --body <s>', desc: 'Attach a short reply to a comment' },
    ],
    flags: ['id', 'body'],
  },
  {
    noun: 'reviewed',
    blurb: 'the files the human has checked off as reviewed (read-only)',
    verbs: [{ verb: 'list', args: '', desc: 'List the reviewed file paths' }],
    flags: [],
  },
  {
    noun: 'intent',
    blurb: 'intent — the case for the change, as documents the human can read',
    verbs: [
      {
        verb: 'prepare',
        args: '[--tabs why,approach,decisions]',
        desc: 'Make the intent dir + assets/, seed the recommended tabs, print the paths',
      },
      {
        verb: 'order',
        args: '--files <a.md,b.html>',
        desc: 'Pin the tab order (comma-separated, left to right)',
      },
      { verb: 'list', args: '', desc: 'List the intent documents on disk' },
    ],
    flags: ['files', 'tabs'],
    flagOverrides: {
      files: 'Document file names inside intent/, comma-separated, in tab order',
    },
  },
  {
    noun: 'evidence',
    blurb: 'evidence — proof the loop closed (checks + Results documents + an image gallery)',
    verbs: [
      {
        verb: 'prepare',
        args: '--title <s>',
        desc: 'Make the pack (results/ + assets/); write the documents there yourself',
      },
      {
        verb: 'set',
        args: '--title <s> (--html <s|-> | --html-file <p>)',
        desc: 'Write results/index.html (small single-document packs only)',
      },
      {
        verb: 'check',
        args: '--label <s> --status pass|fail|skip [--detail <s>]',
        desc: 'Record a verification check (append, or update the same label)',
      },
      {
        verb: 'results-order',
        args: '--files <a.md,b.html>',
        desc: 'Pin the Results tab order (comma-separated, left to right)',
      },
      { verb: 'results-list', args: '', desc: 'List the Results documents on disk' },
      { verb: 'assets-list', args: '', desc: 'List the gallery images with sizes and warnings' },
      { verb: 'get', args: '', desc: 'Read back the pack (checks, Results, gallery, preview)' },
      { verb: 'clear', args: '', desc: 'Remove the evidence' },
    ],
    flags: ['title', 'html', 'html-file', 'label', 'status', 'detail', 'files'],
    flagOverrides: {
      status: 'Check result: pass | fail | skip',
      files: 'Document file names inside evidence/results/, comma-separated, in tab order',
    },
  },
  {
    noun: 'board',
    blurb: 'the project board (todo/doing/done cards)',
    verbs: [
      { verb: 'list', args: '', desc: 'List cards grouped by column' },
      {
        verb: 'create',
        args: '--title <s> [--body <s>] [--status <s>]',
        desc: 'Add a card (defaults to todo)',
      },
      { verb: 'update', args: '--id <s> [--title <s>] [--body <s>]', desc: "Edit a card's fields" },
      { verb: 'move', args: '--id <s> --status <s>', desc: 'Move a card to a column' },
      { verb: 'delete', args: '--id <s>', desc: 'Remove a card' },
    ],
    flags: ['title', 'body', 'status', 'id'],
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
  MIGRATE_COMMANDS,
  {
    noun: 'notes',
    blurb: "the human's per-repo project notes (read-only)",
    verbs: [{ verb: 'get', args: '', desc: 'Read the project notes' }],
    flags: [],
  },
  {
    noun: 'layers',
    blurb: 'the repo-wide review-flow layers (Changes-tab grouping)',
    verbs: [
      { verb: 'get', args: '', desc: 'Read the effective layers (custom or defaults)' },
      { verb: 'set', args: '--layers <json|->', desc: 'Replace the full ordered layer set' },
      { verb: 'reset', args: '', desc: 'Drop the custom set (back to the defaults)' },
    ],
    flags: ['layers'],
  },
  {
    noun: 'scope',
    blurb: 'monorepo hide/pin — folders hidden from the tree or pinned in Quick Access',
    verbs: [
      { verb: 'list', args: '', desc: 'List hidden and pinned paths' },
      { verb: 'hide', args: '--path <p>', desc: 'Hide a folder/file from the tree' },
      { verb: 'unhide', args: '--path <p>', desc: 'Stop hiding a path' },
      { verb: 'pin', args: '--path <p>', desc: 'Pin a path in Quick Access' },
      { verb: 'unpin', args: '--path <p>', desc: 'Remove a pin' },
      { verb: 'clear', args: '', desc: 'Drop all hidden and pinned paths for this repo' },
    ],
    flags: ['path'],
  },
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
  const resolveHtml = (maxBytes: number): string => {
    const args: Record<string, unknown> = {}
    const html = flags.get('html')
    if (html !== undefined) args.html = html === '-' ? readStdin() : html
    const htmlFile = flags.get('html-file')
    if (htmlFile !== undefined) args.htmlFile = htmlFile
    return resolveToolHtml(args, maxBytes)
  }

  const repo = resolveRepo(flags, cwd)

  switch (`${noun} ${verb}`) {
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
      // Match the app's `archiveReview`: drop the set AND the evidence directory
      // (results, screenshots, meta) so nothing from an old review lingers on disk.
      clearReviewCanvas(repo)
      clearReview(repo)
      clearEvidence(repo)
      return `Cleared the review and its evidence for ${repo}`
    case 'comments list':
      return describeComments(
        repo,
        readComments(repo),
        sourceByPath(readActiveReviewSnapshot(repo)),
      )
    case 'comments resolve': {
      const id = req('id')
      return resolveComment(repo, id)
        ? `Resolved comment ${id} for ${repo}`
        : `No open comment ${id} for ${repo}`
    }
    case 'comments answer': {
      const id = req('id')
      const body = req('body')
      return answerComment(repo, id, body)
        ? `Answered comment ${id} for ${repo}`
        : `No comment ${id} for ${repo}`
    }
    case 'reviewed list':
      return describeReviewed(repo, readReviewed(repo))
    case 'intent prepare':
      return describePrepareIntent(repo, splitList(opt('tabs')))
    case 'intent order': {
      const ordered = orderIntent(repo, splitList(opt('files')) ?? [])
      return `Intent tab order for ${repo}: ${ordered.join(' → ')}`
    }
    case 'intent list': {
      const files = listIntent(repo)
      return files.length === 0
        ? `No intent documents for ${repo}. Run \`intent prepare\` first, then write .md / .html there.`
        : `Intent documents for ${repo}:\n${files.map((f) => `  ${f}`).join('\n')}`
    }
    case 'evidence prepare': {
      const prepared = prepareEvidence(repo, opt('title'))
      return `Evidence pack ready for "${prepared.title}". Three parts, three sub-tabs:

  Checks   \`evidence check --label … --status pass|fail|skip\` → ${prepared.dir}/meta.json
           The one-second summary a human reads first. Record what you actually ran.
  Results  ${prepared.resultsDir}
           An ordered .md / .html document set — the narrated proof. Pin the order with
           \`evidence results-order --files a.md,b.html\`.
  Assets   ${prepared.assetsDir}
           Drop raw screenshots here; Porcelain renders them as a native gallery, no HTML
           needed. A shot you also want narrated is referenced from a Results document as
           <img src="../assets/shot.png"> — it stays in the gallery too.

.md renders as prose; .html renders in a sandboxed frame with its local CSS and images inlined. Scripts never run. For large documents write the files yourself rather than passing --html.`
    }
    case 'evidence set': {
      const html = resolveHtml(EVIDENCE_MAX_HTML_BYTES)
      const evidence = setEvidence(repo, opt('title'), html)
      return `Wrote evidence "${evidence.title}" to ${evidence.dir}/${evidence.file} for ${repo}. Porcelain renders it as a Results tab. For anything bigger than one document prefer "evidence prepare" + writing the files yourself.`
    }
    case 'evidence results-order': {
      const ordered = orderResults(repo, splitList(opt('files')) ?? [])
      return `Evidence Results tab order for ${repo}: ${ordered.join(' → ')}`
    }
    case 'evidence results-list': {
      const files = listResults(repo)
      return files.length === 0
        ? `No Results documents for ${repo}. Run \`evidence prepare --title "…"\` first, then write .md / .html there.`
        : `Results documents for ${repo}:\n${files.map((f) => `  ${f}`).join('\n')}`
    }
    case 'evidence assets-list':
      return describeAssets(repo)
    case 'evidence check': {
      const result = checkEvidence(repo, req('label'), req('status'), opt('detail'))
      const overall = evidenceOverallStatus(result.checks)
      const verdict = overall ? ` → ${overall.toUpperCase()}` : ''
      return `Recorded check "${result.check.label}" = ${result.check.status}; ${result.checks.length} check(s)${verdict} for ${repo}.`
    }
    case 'evidence get':
      return describeEvidence(repo, getEvidence(repo))
    case 'evidence clear':
      clearEvidence(repo)
      return `Cleared the loop evidence for ${repo}`
    case 'board list':
      return describeBoard(repo, readCards(repo))
    case 'board create': {
      const title = req('title')
      const status = normalizeStatus(opt('status')) ?? 'todo'
      const card = createCard(repo, title, opt('body'), status)
      return `Created card ${card.id} "${title}" in ${status} for ${repo}`
    }
    case 'board update': {
      const id = req('id')
      const found = updateCard(repo, id, { title: opt('title'), body: opt('body') })
      return found ? `Updated card ${id} for ${repo}` : `No card ${id} for ${repo}`
    }
    case 'board move': {
      const id = req('id')
      const status = normalizeStatus(opt('status'))
      if (!status) throw new Error('status must be one of todo|doing|done')
      return moveCard(repo, id, status)
        ? `Moved card ${id} to ${status} for ${repo}`
        : `No card ${id} for ${repo}`
    }
    case 'board delete': {
      const id = req('id')
      return deleteCard(repo, id) ? `Deleted card ${id} for ${repo}` : `No card ${id} for ${repo}`
    }
    case 'tasks list':
    case 'tasks add':
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
    case 'notes get':
      return describeNotes(repo, readNotes(repo))
    case 'layers get':
      return describeLayers(repo, readLayers(repo))
    case 'layers set': {
      const layers = toLayers(readJson('layers'))
      setLayers(repo, layers)
      return `Set ${layers.length} flow layer(s) for ${repo}: ${layers.map((l) => l.label).join(' → ')}`
    }
    case 'layers reset':
      clearLayers(repo)
      return `Reset flow layers to the Docs + Agents starters for ${repo}`
    case 'scope list':
      return describeScope(repo, readScope(repo))
    case 'scope hide': {
      const path = req('path')
      hideScopePath(repo, path)
      return `Hidden ${path} for ${repo}`
    }
    case 'scope unhide': {
      const path = req('path')
      unhideScopePath(repo, path)
      return `Unhid ${path} for ${repo}`
    }
    case 'scope pin': {
      const path = req('path')
      pinScopePath(repo, path)
      return `Pinned ${path} for ${repo}`
    }
    case 'scope unpin': {
      const path = req('path')
      unpinScopePath(repo, path)
      return `Unpinned ${path} for ${repo}`
    }
    case 'scope clear':
      clearScope(repo)
      return `Cleared hide/pin scope for ${repo}`
    case 'migrate apply':
      return await describeMigrate(repo, {
        dryRun: flags.has('dry-run'),
        reportPath: opt('report'),
      })
    default:
      throw new Error(`unknown command: "${noun} ${verb}" — try "porcelain help"`)
  }
}
