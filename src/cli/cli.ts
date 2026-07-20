import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import {
  createAction,
  deleteAction,
  describeActions,
  readActions,
  updateAction,
} from './action-file'
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
  clearMessages as clearChatMessages,
  describeChat,
  postMessage as postChatMessage,
  readMessages as readChatMessages,
} from './chat-file'
import { answerComment, describeComments, readComments, resolveComment } from './comment-file'
import {
  checkEvidence,
  clearEvidence,
  describeEvidence,
  MAX_HTML_BYTES as EVIDENCE_MAX_HTML_BYTES,
  evidenceOverallStatus,
  getEvidence,
  prepareEvidence,
  setEvidence,
  setEvidenceScene,
} from './evidence-file'
import { describeFeatureView, readFeatureView, sourceByPath } from './feature-view-file'
import { resolveToolHtml } from './html-input'
import { clearLayers, describeLayers, readLayers, setLayers, toLayers } from './layers-file'
import { describeNotes, readNotes } from './notes-file'
import {
  addReviewFiles,
  clearReview,
  clearReviewCanvas,
  describeReview,
  type ReviewSet,
  readReview,
  setReview,
  setReviewCanvas,
  toReviewCanvas,
  toReviewFiles,
  toReviewSections,
} from './review-file'
import { describeReviewed, readReviewed } from './reviewed-file'

// Porcelain's agent CLI: a dependency-free command that reads and writes the watched
// JSON channels under ~/.porcelain (review sets, board, actions, notes, layers,
// evidence, comments, reviewed marks, chat). It replaces the old stdio MCP
// server — a fresh process per invocation doing one synchronous read-modify-write, so
// there is no ordering machinery to keep. Node builtins only, hand-rolled flag parsing:
// the built bundle is copied to ~/.porcelain/porcelain.js and run under a plain `node`,
// which cannot resolve anything from node_modules inside app.asar.

interface CliDeps {
  /** Directory to resolve the repo from when --repo is absent. Default: process.cwd(). */
  cwd?: string
  /** Reads all of stdin (for the `-` sentinel on --files/--layers/--html). Mockable. */
  readStdin?: () => string
}

const BOOLEAN_FLAGS = new Set(['help', 'version', 'closes'])

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

const FLAG_DESCRIPTIONS: Record<string, string> = {
  repo: 'Absolute repo path (default: the git repo containing the current directory)',
  name: 'Feature name shown in Porcelain (default "Feature view")',
  files:
    "Review files as JSON: array of {path, source?: changed|context|shipped, note?, layer?}, in flow order (entry point → data); '-' reads stdin",
  thesis: 'One-paragraph markdown thesis shown at the top of the Review',
  sections:
    "Walkthrough sections as JSON: array of {title, prose (markdown), diagram? (inline SVG), anchors?: [{path, startLine?, endLine?}]}, in flow order; '-' reads stdin",
  title: 'Short title for the item',
  body: 'Body / details text',
  html: "The complete self-contained HTML document, inline; '-' reads stdin",
  'html-file':
    'Absolute path to a local HTML file to read (prefer over --html for large docs with embedded screenshots)',
  id: 'The item id (from the matching list/get command)',
  status: 'Column: todo | doing | done',
  from: 'Origin label (environment or agent id), e.g. "local" or "beelink"',
  intent: 'One line on what you are doing, e.g. "refactoring auth"',
  closes: 'Retire your open claim (pair with --body to note what finished)',
  command: 'The shell command to run',
  cwd: 'Working directory, repo-relative or absolute (defaults to repo root)',
  layers:
    "Flow layers as JSON: array of {label, pattern} in order (entry point → data); '-' reads stdin",
  label: 'Short label for the verification check, e.g. "pnpm test"',
  detail: 'Optional result detail for the check, e.g. "1348 passed"',
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
   * meaning differs by noun (e.g. chat's `--files` is a CSV claim, review's is a JSON array).
   */
  flagOverrides?: Record<string, string>
}

const COMMANDS: NounHelp[] = [
  {
    noun: 'review',
    blurb: 'the feature review set (the files and walkthrough that make up the Review)',
    verbs: [
      {
        verb: 'set',
        args: '[--name <s>] [--thesis <s>] [--sections <json|->] --files <json|->',
        desc: 'Replace the review set',
      },
      { verb: 'add', args: '--files <json|->', desc: 'Add files to the existing set' },
      {
        verb: 'set-canvas',
        args: '--medium html|excalidraw (--html-file <p> | --html <s|-> | --file <scene.excalidraw>)',
        desc: 'Set freeform Overview canvas (html or Excalidraw); outline still uses files/sections',
      },
      {
        verb: 'clear-canvas',
        args: '',
        desc: 'Remove the freeform Overview canvas (back to structured document)',
      },
      { verb: 'get', args: '', desc: 'Read back the declared set' },
      { verb: 'clear', args: '', desc: 'Remove the set (the Review shows its empty state)' },
    ],
    flags: ['name', 'thesis', 'files', 'sections', 'medium', 'html', 'html-file', 'file'],
  },
  {
    noun: 'feature',
    blurb: "Porcelain's computed feature view (declared set folded into git + imports)",
    verbs: [{ verb: 'get', args: '', desc: 'Read the computed feature view' }],
    flags: [],
  },
  {
    noun: 'comments',
    blurb: "the human reviewer's line/file comments",
    verbs: [
      { verb: 'list', args: '', desc: 'List open comments, tagged with feature-view source' },
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
    noun: 'evidence',
    blurb: 'loop evidence — proof the loop closed (browser/simulator validation)',
    verbs: [
      {
        verb: 'prepare',
        args: '--title <s>',
        desc: 'Prepare the on-disk dir; write index.html there yourself',
      },
      {
        verb: 'set',
        args: '--title <s> (--html <s|-> | --html-file <p> | --medium excalidraw --file <scene.excalidraw>)',
        desc: 'Write index.html (HTML) or canvas.excalidraw (Excalidraw medium)',
      },
      {
        verb: 'check',
        args: '--label <s> --status pass|fail|skip [--detail <s>]',
        desc: 'Record a verification check (append, or update the same label)',
      },
      { verb: 'get', args: '', desc: 'Read back the stored evidence (summary + preview)' },
      { verb: 'clear', args: '', desc: 'Remove the evidence' },
    ],
    flags: ['title', 'html', 'html-file', 'label', 'status', 'detail', 'medium', 'file'],
    flagOverrides: {
      status: 'Check result: pass | fail | skip',
      medium: 'Evidence body medium: html (default) | excalidraw',
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
  {
    noun: 'chat',
    blurb: 'the agent chat / relay (local ↔ remote collab)',
    verbs: [
      { verb: 'list', args: '', desc: 'List messages, live claims, and overlaps' },
      {
        verb: 'post',
        args: '--from <s> --body <s> [--files <csv>] [--intent <s>] [--closes]',
        desc: 'Post a message or a file claim',
      },
      { verb: 'clear', args: '', desc: 'Clear the thread' },
    ],
    flags: ['from', 'body', 'files', 'intent', 'closes'],
    flagOverrides: {
      files:
        'Repo-relative paths you are working on, comma-separated — declares a claim so other agents see overlaps',
    },
  },
  {
    noun: 'actions',
    blurb: 'saved actions — named shell commands the human runs in the terminal',
    verbs: [
      { verb: 'list', args: '', desc: 'List saved actions' },
      { verb: 'create', args: '--title <s> --command <s> [--cwd <p>]', desc: 'Add an action' },
      {
        verb: 'update',
        args: '--id <s> [--title <s>] [--command <s>] [--cwd <p>]',
        desc: "Edit an action's fields",
      },
      { verb: 'delete', args: '--id <s>', desc: 'Remove an action' },
    ],
    flags: ['title', 'command', 'cwd', 'id'],
  },
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
 * Run one CLI invocation and return the output string (throws on error). Adapts the
 * old MCP `callTool` dispatch: parse flags, resolve the repo, run one channel op.
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
      const name = opt('name') ?? 'Feature view'
      const files = toReviewFiles(readJson('files'))
      const rawSections = readJson('sections')
      const sections = rawSections === undefined ? [] : toReviewSections(rawSections)
      const set: ReviewSet = { name, files, sections }
      const thesis = opt('thesis')
      if (thesis !== undefined && thesis !== '') set.thesis = thesis
      setReview(repo, set)
      const extras = sections.length > 0 ? `, ${sections.length} section(s)` : ''
      return `Set feature review "${name}" (${files.length} files${extras}) for ${repo}`
    }
    case 'review add': {
      const files = toReviewFiles(readJson('files'))
      const total = addReviewFiles(repo, files)
      return `Added ${files.length} file(s); the feature review now has ${total} for ${repo}`
    }
    case 'review get':
      return describeReview(repo, readReview(repo))
    case 'review clear':
      clearReview(repo)
      return `Cleared the feature review for ${repo}`
    case 'review set-canvas': {
      const medium = req('medium')
      if (medium === 'html') {
        // Overview freeform HTML shares the section-html cap (512 KiB).
        const html = resolveHtml(524_288)
        setReviewCanvas(repo, toReviewCanvas('html', { html }))
        return `Set Overview canvas (html) for ${repo}. Outline still uses thesis/sections/files.`
      }
      if (medium === 'excalidraw') {
        const file = req('file')
        const sceneRaw = readFileSync(file, 'utf8')
        setReviewCanvas(repo, toReviewCanvas('excalidraw', { sceneRaw }))
        return `Set Overview canvas (excalidraw) for ${repo} from ${file}. Outline still uses thesis/sections/files.`
      }
      throw new Error('medium must be html or excalidraw')
    }
    case 'review clear-canvas':
      return clearReviewCanvas(repo)
        ? `Cleared the Overview canvas for ${repo} (structured document restored if sections exist)`
        : `No Overview canvas set for ${repo}`
    case 'feature get':
      return describeFeatureView(repo, readFeatureView(repo))
    case 'comments list':
      return describeComments(repo, readComments(repo), sourceByPath(readFeatureView(repo)))
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
    case 'evidence prepare': {
      const prepared = prepareEvidence(repo, opt('title'))
      return `Loop evidence directory ready for "${prepared.title}" at:\n${prepared.dir}\n\nWrite index.html (HTML body) or canvas.excalidraw (Excalidraw body) there — HTML wins if both exist. Screenshots as sibling files with relative <img src="shot.png">. Porcelain picks it up on the Loop evidence canvas tab. For large HTML, write the file yourself rather than passing --html.`
    }
    case 'evidence set': {
      const medium = opt('medium') ?? 'html'
      if (medium === 'excalidraw') {
        const file = req('file')
        const sceneRaw = readFileSync(file, 'utf8')
        const evidence = setEvidenceScene(repo, opt('title'), sceneRaw)
        return `Wrote loop evidence "${evidence.title}" to ${evidence.dir}/canvas.excalidraw for ${repo}. Porcelain renders it on the Loop evidence canvas tab.`
      }
      if (medium !== 'html') throw new Error('medium must be html or excalidraw')
      const html = resolveHtml(EVIDENCE_MAX_HTML_BYTES)
      const evidence = setEvidence(repo, opt('title'), html)
      return `Wrote loop evidence "${evidence.title}" to ${evidence.dir}/index.html for ${repo}. Porcelain renders it on the Loop evidence canvas tab. For large docs prefer "evidence prepare" + writing index.html yourself.`
    }
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
    case 'chat list':
      return describeChat(repo, readChatMessages(repo))
    case 'chat post': {
      const from = req('from')
      // Chat's --files is a plain CSV claim (agents shouldn't hand-write JSON for a quick
      // claim), independent of review's JSON --files (readJson). See the noun flagOverride.
      const filesRaw = opt('files')
      const files = filesRaw
        ? filesRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined
      const intent = opt('intent')?.trim() || undefined
      const closes = flags.has('closes')
      const isClaim = files !== undefined && files.length > 0
      // Body is required for a plain message; for a claim or close it can be synthesized from
      // the intent/footprint so the message still carries readable text (the app schema needs
      // a non-empty body). Lets an agent post a quick claim without repeating itself in --body.
      let body = opt('body')?.trim()
      if (!body) {
        if (files && files.length > 0) body = intent ?? `Working on ${files.join(', ')}`
        else if (closes) body = intent ?? 'Closed claim'
        else throw new Error('body is required')
      }
      const message = postChatMessage(repo, { from, body, files, intent, closes })
      return isClaim
        ? `Posted claim ${message.id} as "${from}" — ${files?.length ?? 0} file(s) for ${repo}`
        : `Posted chat message ${message.id} as "${from}" for ${repo}`
    }
    case 'chat clear':
      return clearChatMessages(repo)
        ? `Cleared agent chat for ${repo}`
        : `Agent chat for ${repo} was already empty`
    case 'actions list':
      return describeActions(repo, readActions(repo))
    case 'actions create': {
      const title = req('title')
      const command = req('command')
      const action = createAction(repo, title, command, opt('cwd'))
      return `Created action ${action.id} "${title}" for ${repo}`
    }
    case 'actions update': {
      const id = req('id')
      const found = updateAction(repo, id, {
        title: opt('title'),
        command: opt('command'),
        cwd: opt('cwd'),
      })
      return found ? `Updated action ${id} for ${repo}` : `No action ${id} for ${repo}`
    }
    case 'actions delete': {
      const id = req('id')
      return deleteAction(repo, id)
        ? `Deleted action ${id} for ${repo}`
        : `No action ${id} for ${repo}`
    }
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
      return `Reset flow layers to the built-in defaults for ${repo}`
    default:
      throw new Error(`unknown command: "${noun} ${verb}" — try "porcelain help"`)
  }
}
