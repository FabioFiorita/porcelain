import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
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

const execFileAsync = promisify(execFile)

const COMMIT_GENERATION_EFFORT = 'medium'
const MAX_CONTEXT_CHARS = 48_000
const MAX_UNTRACKED_FILE_CHARS = 16_000
const MODEL_TIMEOUT_MS = 180_000
const MODEL_OUTPUT_BYTES = 4 * 1024 * 1024
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g')

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

/** Check provider installation without making a model request or changing state. */
async function commandAvailable(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ['--version'], {
      env: process.env,
      maxBuffer: 64 * 1024,
      timeout: 10_000,
    })
    return true
  } catch (error) {
    // A provider can return a non-zero version status while still being installed
    // (for example, when it prints an auth warning). ENOENT is the useful signal.
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

  let stdout: string
  try {
    const result = await execFileAsync('opencode', ['models'], {
      env: process.env,
      maxBuffer: MODEL_OUTPUT_BYTES,
      timeout: 15_000,
    })
    stdout = String(result.stdout)
  } catch {
    return []
  }

  return parseOpenCodeCommitModels(stdout)
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

function jsonValueFromText(text: string): unknown {
  const trimmed = text.trim()
  const withoutFence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? trimmed
  try {
    return JSON.parse(withoutFence) as unknown
  } catch {
    const start = withoutFence.indexOf('{')
    const end = withoutFence.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(withoutFence.slice(start, end + 1)) as unknown
    } catch {
      return null
    }
  }
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

/** Parse and normalize one model response into the text used by the composer. */
export function parseGeneratedCommitMessage(raw: string): string {
  const value = resolveModelOutput(raw)
  const parsed = generatedMessageSchema.safeParse(value)
  if (!parsed.success) throw new Error('The selected model returned an invalid commit message.')
  return formatMessage({ subject: parsed.data.subject, body: parsed.data.body ?? '' })
}

/** Validate a model-proposed split and normalize every group's commit message. */
export function parseGeneratedCommitGroups(
  raw: string,
  expectedFiles: readonly string[],
): Array<{ files: string[]; message: string }> {
  const value = resolveModelOutput(raw)
  const parsed = generatedGroupsSchema.safeParse(value)
  if (!parsed.success) throw new Error('The selected model returned invalid commit groups.')

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

async function runTextModel(model: CommitModel, cwd: string, prompt: string): Promise<string> {
  const options = {
    cwd,
    env: process.env,
    maxBuffer: MODEL_OUTPUT_BYTES,
    timeout: MODEL_TIMEOUT_MS,
  }

  try {
    const command = await resolveModelCommand(model)
    if (command.provider === 'codex') {
      const tempDir = await mkdtemp(join(tmpdir(), 'porcelain-commit-'))
      const outputPath = join(tempDir, 'message.txt')
      try {
        await execFileAsync(
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
            'model_reasoning_effort=medium',
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
      const { stdout, stderr } = await execFileAsync(
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
      const output = String(stdout).trim() === '' ? String(stderr) : String(stdout)
      return openCodeTextFromEvents(output)
    }

    const args =
      command.provider === 'claude'
        ? [
            '--bare',
            '--no-session-persistence',
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
        : [
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
    const { stdout } = await execFileAsync(command.provider, args, options)
    return String(stdout)
  } catch (error) {
    throw new Error(`Unable to generate a commit message with ${model}: ${errorOutput(error)}`)
  }
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
