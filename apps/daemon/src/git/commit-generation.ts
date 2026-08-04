import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  COMMIT_MODEL_IDS,
  COMMIT_MODEL_OPTIONS,
  type CommitModel,
  type CommitModelOption,
  commitModelOptionsSchema,
} from '@porcelain/contracts'
import { z } from 'zod'
import type { ChangedFile } from './diff'
import { runGit as gitRead, gitStatus } from './git'

const COMMIT_GENERATION_EFFORT = 'medium'
const MAX_CONTEXT_CHARS = 48_000
const MAX_UNTRACKED_FILE_CHARS = 16_000
const MODEL_TIMEOUT_MS = 180_000
const MODEL_OUTPUT_BYTES = 4 * 1024 * 1024
const VERSION_TIMEOUT_MS = 10_000
const MODEL_LIST_TIMEOUT_MS = 15_000
/** Grace between SIGTERM and SIGKILL when a model CLI overruns its timeout. */
const KILL_GRACE_MS = 2_000
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g')

/**
 * Startup chatter that is never the reason a run failed. Both lines exist because
 * a CLI found an stdin pipe; they used to be the entire error the human saw.
 */
const CLI_NOISE = [/^Warning: no stdin data received/i, /^Reading additional input from stdin/i]

interface ModelCommand {
  provider: 'claude' | 'codex' | 'grok' | 'opencode'
  model: string
}

type BuiltInCommitModel = (typeof COMMIT_MODEL_IDS)[number]

const MODEL_COMMANDS: Record<BuiltInCommitModel, ModelCommand> = {
  luna: { provider: 'codex', model: 'gpt-5.6-luna' },
  terra: { provider: 'codex', model: 'gpt-5.6-terra' },
  sonnet: { provider: 'claude', model: 'sonnet' },
  opus: { provider: 'claude', model: 'opus' },
  haiku: { provider: 'claude', model: 'haiku' },
  sol: { provider: 'codex', model: 'gpt-5.6-sol' },
  'grok-4.5': { provider: 'grok', model: 'grok-4.5' },
}

const BUILT_IN_PROVIDER_COMMANDS: Record<BuiltInCommitModel, 'claude' | 'codex' | 'grok'> = {
  luna: 'codex',
  terra: 'codex',
  sonnet: 'claude',
  opus: 'claude',
  haiku: 'claude',
  sol: 'codex',
  'grok-4.5': 'grok',
}

const OPEN_CODE_MODEL_TARGETS = [
  {
    label: 'GLM 5.2',
    matches: [/\bglm[-_. ]?5[-_. ]?2\b/i],
  },
  {
    label: 'Kimi v2.7',
    matches: [/\bkimi[-_. ]?(?:v[-_. ]?)?2[-_. ]?7\b/i, /\bkimi[-_. ]?k[-_. ]?2[-_. ]?7\b/i],
  },
  {
    label: 'Kimi v3',
    matches: [/\bkimi[-_. ]?(?:v[-_. ]?)?3\b/i, /\bkimi[-_. ]?k[-_. ]?3\b/i],
  },
] as const

interface CommitGenerationContext {
  branch: string | null
  files: string[]
  summary: string
  patch: string
}

export interface CommitGenerationPromptInput {
  mode: 'single' | 'groups'
  branch: string | null
  files: readonly string[]
  summary: string
  patch: string
}

interface GeneratedMessage {
  subject: string
  body: string
}

const generatedMessageSchema = z.object({
  subject: z.string(),
  body: z.string().optional(),
})

const generatedGroupsSchema = z.object({
  groups: z
    .array(
      z.object({
        files: z.array(z.string()).min(1),
        subject: z.string(),
        body: z.string().optional(),
      }),
    )
    .min(1),
})

function isBuiltInCommitModel(model: CommitModel): model is BuiltInCommitModel {
  return COMMIT_MODEL_IDS.includes(model as BuiltInCommitModel)
}

function errorCode(error: unknown): string | number | undefined {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = error.code
    return typeof code === 'string' || typeof code === 'number' ? code : undefined
  }
  return undefined
}

/**
 * GUI apps and systemd units often ship a minimal PATH that omits user installs
 * (`~/.local/bin` for claude/codex, `~/.grok/bin`). Prepend common bins so model
 * discovery and generation match what the human has in a shell.
 */
export function agentCliPath(pathEnv: string | undefined, home: string | undefined): string {
  const extras = [
    home ? join(home, '.local', 'bin') : '',
    home ? join(home, '.volta', 'bin') : '',
    home ? join(home, '.grok', 'bin') : '',
    home ? join(home, '.cargo', 'bin') : '',
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ].filter((part) => part !== '')
  const seen = new Set<string>()
  const parts: string[] = []
  for (const part of [...extras, ...(pathEnv ?? '').split(':')]) {
    if (part === '' || seen.has(part)) continue
    seen.add(part)
    parts.push(part)
  }
  return parts.join(':')
}

function agentCliEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...base,
    PATH: agentCliPath(base.PATH, base.HOME),
  }
}

interface CliRun {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

interface CliOptions {
  cwd?: string
  timeout: number
  maxBytes: number
}

/**
 * Spawn a CLI with stdin CLOSED. `execFile` builds its own spawn options and drops
 * `stdio`, so every model CLI inherited a stdin pipe nobody would ever write to or
 * close: `codex exec` parks on "Reading additional input from stdin..." forever and
 * `claude` stalls three seconds before warning. `stdio[0]: 'ignore'` is the fix.
 *
 * The child leads its own process group so a timeout can take its children with it —
 * these CLIs fork helpers that keep running when only the parent is signalled.
 * A non-zero exit RESOLVES; only a failure to spawn rejects, so callers can read the
 * output a failing run produced (that is where the real error usually is).
 */
function runCli(command: string, args: string[], options: CliOptions): Promise<CliRun> {
  return new Promise<CliRun>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: agentCliEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      if (stdout.length < options.maxBytes) stdout += chunk
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < options.maxBytes) stderr += chunk
    })

    const killGroup = (signal: NodeJS.Signals): void => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, signal)
      } catch {
        // The group already exited between the timeout firing and this signal.
      }
    }

    let escalation: NodeJS.Timeout | null = null
    const timer = setTimeout(() => {
      timedOut = true
      killGroup('SIGTERM')
      // A CLI mid-request can swallow SIGTERM; escalate instead of hanging on it.
      escalation = setTimeout(() => killGroup('SIGKILL'), KILL_GRACE_MS)
    }, options.timeout)

    const done = (): void => {
      clearTimeout(timer)
      if (escalation !== null) clearTimeout(escalation)
    }

    child.on('error', (error) => {
      done()
      reject(error)
    })
    child.on('close', (code) => {
      done()
      resolve({ code, stdout, stderr, timedOut })
    })
  })
}

/** Check provider installation without making a model request or changing state. */
async function commandAvailable(command: string): Promise<boolean> {
  try {
    await runCli(command, ['--version'], {
      timeout: VERSION_TIMEOUT_MS,
      maxBytes: 64 * 1024,
    })
    // A provider can return a non-zero version status while still being installed
    // (for example, when it prints an auth warning). ENOENT is the useful signal.
    return true
  } catch (error) {
    return errorCode(error) !== 'ENOENT'
  }
}

function modelToken(line: string): string | null {
  const cleaned = line.replace(ANSI_ESCAPE, '')
  for (const token of cleaned.split(/\s+/g)) {
    const candidate = token.replace(/^[`"'([{]+|[`"'\])},;]+$/g, '')
    if (/^[A-Za-z0-9][A-Za-z0-9._-]*\/\S+$/.test(candidate)) return candidate
  }
  return null
}

function parseOpenCodeModelList(stdout: string): string[] {
  return [
    ...new Set(
      stdout
        .split(/\r?\n/g)
        .map(modelToken)
        .filter((model): model is string => model !== null),
    ),
  ]
}

export function parseOpenCodeCommitModels(stdout: string): CommitModelOption[] {
  const options: CommitModelOption[] = []
  for (const model of parseOpenCodeModelList(stdout)) {
    const target = OPEN_CODE_MODEL_TARGETS.find(({ matches }) =>
      matches.some((match) => match.test(model)),
    )
    if (!target) continue
    options.push({
      id: `opencode:${model}`,
      label: `${target.label} (${model.split('/')[0]})`,
      provider: 'opencode',
    })
  }
  return options
}

async function discoverOpenCodeModels(isAvailable: boolean): Promise<CommitModelOption[]> {
  if (!isAvailable) return []

  let run: CliRun
  try {
    run = await runCli('opencode', ['models'], {
      timeout: MODEL_LIST_TIMEOUT_MS,
      maxBytes: MODEL_OUTPUT_BYTES,
    })
  } catch {
    return []
  }
  if (run.code !== 0) return []

  return parseOpenCodeCommitModels(run.stdout)
}

/**
 * Return only the curated models whose local provider is available. OpenCode's
 * own model inventory is the provider check for its dynamically configured models.
 */
export async function listCommitModels(): Promise<CommitModelOption[]> {
  const [claudeAvailable, codexAvailable, grokAvailable, openCodeAvailable] = await Promise.all([
    commandAvailable('claude'),
    commandAvailable('codex'),
    commandAvailable('grok'),
    commandAvailable('opencode'),
  ])
  const availableProviders = new Set(
    [
      claudeAvailable ? 'claude' : null,
      codexAvailable ? 'codex' : null,
      grokAvailable ? 'grok' : null,
    ].filter((provider): provider is 'claude' | 'codex' | 'grok' => provider !== null),
  )
  const builtIn = COMMIT_MODEL_OPTIONS.flatMap((option) => {
    const provider = BUILT_IN_PROVIDER_COMMANDS[option.id]
    return availableProviders.has(provider) ? [{ ...option, provider }] : []
  })
  const openCode = await discoverOpenCodeModels(openCodeAvailable)
  return commitModelOptionsSchema.parse([...builtIn, ...openCode])
}

function selectedOpenCodeModel(model: CommitModel): string | null {
  if (!model.startsWith('opencode:')) return null
  const selected = model.slice('opencode:'.length)
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\/\S+$/.test(selected) ? selected : null
}

async function resolveModelCommand(model: CommitModel): Promise<ModelCommand> {
  const available = await listCommitModels()
  if (!available.some((option) => option.id === model)) {
    throw new Error(`The selected commit model is not available: ${model}`)
  }

  if (isBuiltInCommitModel(model)) return MODEL_COMMANDS[model]
  const openCodeModel = selectedOpenCodeModel(model)
  if (openCodeModel === null) throw new Error(`Invalid OpenCode commit model: ${model}`)
  return { provider: 'opencode', model: openCodeModel }
}

function limitSection(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars)}\n\n[truncated]`
}

/** Build the structured prompt shared by every supported local model CLI. */
export function buildCommitGenerationPrompt(input: CommitGenerationPromptInput): string {
  const groupRules =
    input.mode === 'groups'
      ? [
          '- group files that belong to one coherent change',
          '- use one group when all changes clearly belong together',
          '- every listed file must appear in exactly one group',
          '- return groups in a useful commit order',
          'Return only JSON shaped like {"groups":[{"files":["path"],"subject":"...","body":"..."}]}.',
        ]
      : ['Return only JSON shaped like {"subject":"...","body":"..."}.']

  return [
    'You write concise git commit messages from supplied repository changes.',
    'Do not edit files, run commands, or make a commit. Analyze the supplied context only.',
    'Rules:',
    '- each subject must be imperative, no more than 72 characters, and have no trailing period',
    '- body may be an empty string or short bullet points',
    '- describe the primary user-visible or developer-visible change',
    ...groupRules,
    '',
    `Branch: ${input.branch ?? '(detached)'}`,
    '',
    'Changed files:',
    input.files.map((file) => `- ${file}`).join('\n'),
    '',
    'Change summary:',
    limitSection(input.summary, 8_000),
    '',
    'Change patch and untracked-file contents:',
    limitSection(input.patch, MAX_CONTEXT_CHARS),
  ].join('\n')
}

function errorOutput(error: unknown): string {
  if (error !== null && typeof error === 'object') {
    if ('stderr' in error && typeof error.stderr === 'string' && error.stderr.trim() !== '') {
      return error.stderr.trim()
    }
    if ('stdout' in error && typeof error.stdout === 'string' && error.stdout.trim() !== '') {
      return error.stdout.trim()
    }
  }
  return error instanceof Error ? error.message : String(error)
}

/** Drop ANSI and startup chatter so what is left is a reason, not a banner. */
export function meaningfulOutput(value: string): string | null {
  const lines = value
    .split(/\r?\n/g)
    .map((line) => line.replace(ANSI_ESCAPE, '').trim())
    .filter((line) => line !== '' && !CLI_NOISE.some((pattern) => pattern.test(line)))
  return lines.length === 0 ? null : lines.join('\n')
}

/**
 * Claude reports auth and API failures inside its stdout JSON envelope — often with
 * a zero exit code and an empty stderr. Reading only stderr turned "Not logged in ·
 * Please run /login" into a bare stdin warning, which is what the human was shown.
 */
export function claudeEnvelopeError(stdout: string): string | null {
  const value = jsonValueFromText(stdout)
  if (!isRecord(value) || value.is_error !== true) return null
  const result = typeof value.result === 'string' ? value.result.trim() : ''
  return result === '' ? 'the model reported an error with no detail' : result
}

/** Describe why a model run is unusable, or null when it produced a usable answer. */
export function cliFailure(run: CliRun, command: string): string | null {
  if (run.timedOut) {
    return `${command} did not respond within ${Math.round(MODEL_TIMEOUT_MS / 1000)}s`
  }
  // A zero exit is not success for Claude: it reports auth and API failures in the
  // envelope. Prefer that over whichever stream happens to be non-empty.
  const envelope = claudeEnvelopeError(run.stdout)
  if (run.code === 0) return envelope
  return (
    envelope ??
    meaningfulOutput(run.stderr) ??
    meaningfulOutput(run.stdout) ??
    `${command} exited with code ${run.code ?? 'unknown'}`
  )
}

async function runGit(repoPath: string, args: string[]): Promise<string> {
  try {
    return await gitRead(repoPath, args)
  } catch (error) {
    throw new Error(errorOutput(error))
  }
}

async function branchName(repoPath: string): Promise<string | null> {
  try {
    const branch = (await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
    return branch === '' || branch === 'HEAD' ? null : branch
  } catch {
    return null
  }
}

function uniquePaths(files: readonly ChangedFile[]): string[] {
  return [...new Set(files.map((file) => file.path))]
}

async function untrackedContent(repoPath: string, path: string): Promise<string> {
  try {
    const filePath = join(repoPath, path)
    const fileInfo = await stat(filePath)
    if (fileInfo.size > MAX_UNTRACKED_FILE_CHARS) {
      return `--- ${path} (untracked, content omitted because it is too large) ---`
    }
    const content = await readFile(filePath, 'utf8')
    if (content.includes('\0')) return `--- ${path} (untracked binary file omitted) ---`
    return `--- ${path} (untracked) ---\n${content}`
  } catch {
    return `--- ${path} (untracked, content unavailable) ---`
  }
}

async function stagedContext(repoPath: string): Promise<CommitGenerationContext> {
  const files = (await gitStatus(repoPath)).filter((file) => file.staged === true)
  const paths = uniquePaths(files)
  if (paths.length === 0) {
    throw new Error('Stage at least one file before generating a commit message.')
  }

  const [summary, patch, branch] = await Promise.all([
    runGit(repoPath, ['diff', '--cached', '--name-status', '--no-renames', '--no-color', '--']),
    runGit(repoPath, ['diff', '--cached', '--no-ext-diff', '--no-color', '--minimal', '--']),
    branchName(repoPath),
  ])
  if (patch.trim() === '') {
    throw new Error('The staged changes disappeared before the message could be generated.')
  }
  return { branch, files: paths, summary, patch }
}

async function unstagedContext(repoPath: string): Promise<CommitGenerationContext> {
  const files = (await gitStatus(repoPath)).filter((file) => file.unstaged === true)
  const paths = uniquePaths(files)
  if (paths.length === 0) throw new Error('There are no unstaged changes to group.')

  const trackedPaths = files.filter((file) => file.status !== 'untracked').map((file) => file.path)
  const untrackedPaths = files
    .filter((file) => file.status === 'untracked')
    .map((file) => file.path)
  const [trackedSummary, trackedPatch, untracked, branch] = await Promise.all([
    trackedPaths.length > 0
      ? runGit(repoPath, ['diff', '--name-status', '--no-color', '--', ...trackedPaths])
      : Promise.resolve(''),
    trackedPaths.length > 0
      ? runGit(repoPath, [
          'diff',
          '--no-ext-diff',
          '--no-color',
          '--minimal',
          '--',
          ...trackedPaths,
        ])
      : Promise.resolve(''),
    Promise.all(untrackedPaths.map((path) => untrackedContent(repoPath, path))),
    branchName(repoPath),
  ])

  const untrackedSummary = untrackedPaths.map((path) => `??\t${path}`).join('\n')
  const summary = [trackedSummary.trim(), untrackedSummary].filter(Boolean).join('\n')
  const patch = [trackedPatch.trim(), untracked.join('\n\n')].filter(Boolean).join('\n\n')
  if (patch.trim() === '') throw new Error('The unstaged changes disappeared before grouping.')
  return { branch, files: paths, summary, patch }
}

/**
 * Collect balanced top-level `{…}` spans, ignoring braces inside strings. Models
 * routinely wrap the answer in prose ("I'll check the workspace…{…}"), and a
 * first-brace/last-brace slice silently spans everything between two objects.
 */
export function jsonObjectCandidates(text: string): string[] {
  const candidates: string[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') {
      if (depth === 0) start = index
      depth += 1
    } else if (char === '}' && depth > 0) {
      depth -= 1
      if (depth === 0 && start !== -1) candidates.push(text.slice(start, index + 1))
    }
  }
  return candidates
}

function jsonValueFromText(text: string): unknown {
  const trimmed = text.trim()
  const withoutFence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? trimmed
  try {
    return JSON.parse(withoutFence) as unknown
  } catch {
    // Not a bare JSON document — fall through to the embedded-object scan.
  }
  // Last first: when a model narrates before answering, the answer is what it ended on.
  const candidates = jsonObjectCandidates(withoutFence)
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(candidates[index] as string) as unknown
    } catch {
      // Try the next candidate rather than giving up on the whole response.
    }
  }
  return null
}

/** OpenCode's JSON format is a stream of events; join only assistant text events. */
function openCodeTextFromEvents(raw: string): string {
  const parts: string[] = []
  for (const line of raw.split(/\r?\n/g)) {
    if (line.trim() === '') continue
    try {
      const event: unknown = JSON.parse(line)
      if (!isRecord(event) || event.type !== 'text') continue
      const part = event.part
      if (isRecord(part) && typeof part.text === 'string') parts.push(part.text)
      else if (typeof event.text === 'string') parts.push(event.text)
    } catch {
      return raw
    }
  }
  return parts.join('') || raw
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function resolveModelOutput(value: unknown, depth = 0): unknown {
  if (depth > 5) return null
  if (typeof value === 'string') {
    const parsed = jsonValueFromText(value)
    return parsed === null ? value : resolveModelOutput(parsed, depth + 1)
  }
  if (Array.isArray(value)) {
    for (let i = value.length - 1; i >= 0; i -= 1) {
      const resolved = resolveModelOutput(value[i], depth + 1)
      if (isRecord(resolved) && ('subject' in resolved || 'groups' in resolved)) return resolved
    }
    return null
  }
  if (!isRecord(value)) return value
  if ('subject' in value || 'groups' in value) return value
  for (const key of [
    'structured_output',
    'structuredOutput',
    'result',
    // Grok Build's `--output-format json` envelope carries the answer here; without
    // it a perfectly good response resolved to null ("returned invalid commit groups").
    'text',
    'output',
    'message',
    'data',
  ]) {
    if (key in value) {
      const resolved = resolveModelOutput(value[key], depth + 1)
      if (isRecord(resolved) && ('subject' in resolved || 'groups' in resolved)) return resolved
    }
  }
  return null
}

function sanitizeSubject(raw: string): string {
  const line = raw.trim().split(/\r?\n/g)[0]?.trim() ?? ''
  const withoutPeriod = line.replace(/[.]+$/g, '').trim()
  if (withoutPeriod === '') return 'Update project files'
  return withoutPeriod.slice(0, 72).trimEnd()
}

function formatMessage(message: GeneratedMessage): string {
  const subject = sanitizeSubject(message.subject)
  const body = message.body.trim()
  return body === '' ? subject : `${subject}\n\n${body}`
}

/**
 * Quote back what actually arrived. "returned an invalid commit message" alone gives
 * the human nothing to act on and hides whether the model refused, timed out, or
 * simply answered in prose.
 */
function responseSnippet(raw: string): string {
  const text = raw.replace(ANSI_ESCAPE, '').replace(/\s+/g, ' ').trim()
  if (text === '') return 'the response was empty'
  return text.length > 200 ? `${text.slice(0, 200)}…` : text
}

/** Parse and normalize one model response into the text used by the composer. */
export function parseGeneratedCommitMessage(raw: string): string {
  const value = resolveModelOutput(raw)
  const parsed = generatedMessageSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(
      `The selected model returned an invalid commit message: ${responseSnippet(raw)}`,
    )
  }
  return formatMessage({ subject: parsed.data.subject, body: parsed.data.body ?? '' })
}

/** Validate a model-proposed split and normalize every group's commit message. */
export function parseGeneratedCommitGroups(
  raw: string,
  expectedFiles: readonly string[],
): Array<{ files: string[]; message: string }> {
  const value = resolveModelOutput(raw)
  const parsed = generatedGroupsSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`The selected model returned invalid commit groups: ${responseSnippet(raw)}`)
  }

  const expected = new Set(expectedFiles)
  const seen = new Set<string>()
  const groups = parsed.data.groups.map((group) => {
    const files = [...new Set(group.files)]
    if (files.length !== group.files.length || files.some((path) => !expected.has(path))) {
      throw new Error('The selected model returned an unsafe file grouping.')
    }
    if (files.some((path) => seen.has(path))) {
      throw new Error('The selected model placed a file in more than one commit group.')
    }
    for (const path of files) seen.add(path)
    return { files, message: formatMessage({ subject: group.subject, body: group.body ?? '' }) }
  })
  if (seen.size !== expected.size) {
    throw new Error('The selected model omitted a changed file from the commit groups.')
  }
  return groups
}

/** Run one model CLI, converting an unusable run into the error the human reads. */
async function runModelCli(
  model: CommitModel,
  command: string,
  args: string[],
  options: CliOptions,
): Promise<CliRun> {
  let run: CliRun
  try {
    run = await runCli(command, args, options)
  } catch (error) {
    throw new Error(`Unable to generate a commit message with ${model}: ${errorOutput(error)}`)
  }
  const failure = cliFailure(run, command)
  if (failure !== null) {
    throw new Error(`Unable to generate a commit message with ${model}: ${failure}`)
  }
  return run
}

/**
 * `--bare` is deliberately absent for Claude: its own help states OAuth and keychain
 * are never read under it, so on a subscription login it can only answer "Not logged
 * in · Please run /login". Pinning an empty MCP config keeps the run isolated —
 * which is what `--bare` was reached for — without discarding the human's credentials.
 */
function providerArgs(command: ModelCommand, prompt: string): string[] {
  if (command.provider === 'claude') {
    return [
      '--no-session-persistence',
      '--strict-mcp-config',
      '--mcp-config',
      '{"mcpServers":{}}',
      '--model',
      command.model,
      '--effort',
      COMMIT_GENERATION_EFFORT,
      '--tools',
      '',
      '--output-format',
      'json',
      '--print',
      prompt,
    ]
  }
  return [
    '--model',
    command.model,
    '--reasoning-effort',
    COMMIT_GENERATION_EFFORT,
    '--output-format',
    'json',
    '--no-memory',
    '--no-subagents',
    '--disable-web-search',
    '--tools',
    '',
    '--single',
    prompt,
  ]
}

async function runTextModel(model: CommitModel, cwd: string, prompt: string): Promise<string> {
  const command = await resolveModelCommand(model)
  const options: CliOptions = { cwd, timeout: MODEL_TIMEOUT_MS, maxBytes: MODEL_OUTPUT_BYTES }

  if (command.provider === 'codex') {
    const tempDir = await mkdtemp(join(tmpdir(), 'porcelain-commit-'))
    const outputPath = join(tempDir, 'message.txt')
    try {
      await runModelCli(
        model,
        'codex',
        [
          'exec',
          '--ephemeral',
          '--sandbox',
          'read-only',
          '--skip-git-repo-check',
          '--model',
          command.model,
          '--config',
          `model_reasoning_effort=${COMMIT_GENERATION_EFFORT}`,
          '--color',
          'never',
          '--output-last-message',
          outputPath,
          prompt,
        ],
        options,
      )
      return await readFile(outputPath, 'utf8')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }

  if (command.provider === 'opencode') {
    const run = await runModelCli(
      model,
      'opencode',
      [
        'run',
        '--model',
        command.model,
        '--agent',
        'plan',
        '--format',
        'json',
        '--variant',
        COMMIT_GENERATION_EFFORT,
        '--dir',
        cwd,
        prompt,
      ],
      options,
    )
    const output = run.stdout.trim() === '' ? run.stderr : run.stdout
    return openCodeTextFromEvents(output)
  }

  const run = await runModelCli(model, command.provider, providerArgs(command, prompt), options)
  return run.stdout
}

export async function generateCommitMessage(repoPath: string, model: CommitModel): Promise<string> {
  const context = await stagedContext(repoPath)
  const raw = await runTextModel(
    model,
    repoPath,
    buildCommitGenerationPrompt({ ...context, mode: 'single' }),
  )
  return parseGeneratedCommitMessage(raw)
}

export async function generateCommitGroups(
  repoPath: string,
  model: CommitModel,
): Promise<Array<{ files: string[]; message: string }>> {
  const staged = (await gitStatus(repoPath)).some((file) => file.staged === true)
  if (staged) throw new Error('Unstage all files before generating commit groups.')
  const context = await unstagedContext(repoPath)
  const raw = await runTextModel(
    model,
    repoPath,
    buildCommitGenerationPrompt({ ...context, mode: 'groups' }),
  )
  return parseGeneratedCommitGroups(raw, context.files)
}
