#!/usr/bin/env node
/**
 * The commit-message gate, run from `.husky/commit-msg`.
 *
 * The hard rule is external: EAS caps a workflow's `message` / `changelog`
 * param at 1024 characters, and `apps/mobile/.eas/workflows/preview.yml` feeds
 * `github.commit_message` into both. A longer commit message on `main` fails
 * the whole delivery run with `Failed to start job — String must contain at
 * most 1024 character(s)`, so preview delivery silently stops instead of
 * shipping. The workflows also truncate defensively (a squash-merge composed in
 * GitHub's UI never reaches this hook), but the message is worth keeping under
 * the limit at the source: a truncated changelog is a worse changelog.
 *
 * The rest are house style, and are only here because every commit in this
 * repository's history already follows them — the hook stops drift, it does not
 * introduce a convention. `git log --format=%s` is the reference.
 *
 * Length is measured AFTER reproducing `git commit --cleanup=default`, because
 * that is what Git will actually store: this hook receives the raw editor file,
 * comment block and all, and measuring that would reject messages that are
 * comfortably inside the limit once Git is done with them.
 *
 * Self-checked by decoys at the bottom, matching `lint-audit.mjs`: `pnpm test`
 * only collects `src/**`, so a `scripts/` checker proves itself or nothing does.
 */

import { readFileSync } from 'node:fs'

/** EAS's limit on a build/update `message` and a TestFlight `changelog`. */
export const MAX_MESSAGE = 1024
/** Fits `git log --oneline` in an 80-column terminal after the short hash. */
export const MAX_SUBJECT = 72
/** Body lines wider than this are a warning — never a rejection. */
export const MAX_BODY_LINE = 100

/** Conventional-commit types, matching what `pnpm changelog` groups on. */
const TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
]
const SUBJECT = new RegExp(`^(?:${TYPES.join('|')})(?:\\([a-z0-9._/-]+\\))?!?: .+`)

/**
 * Messages Git composes itself. Rejecting these would break `git merge`,
 * `git revert`, and the autosquash flow without teaching anyone anything.
 */
const GENERATED = /^(?:Merge |Revert |fixup!|squash!|amend!)/

/**
 * A line that cannot be rewrapped: a bare URL, a fenced or indented code block,
 * a table row, or a trailer. Warning only, but a false positive here trains
 * people to ignore the output.
 */
const UNWRAPPABLE = /^(?:\s{4,}|\s*[|`>]|\S+:\/\/|[A-Za-z-]+: \S+$)|\S+:\/\/\S{40,}/

/**
 * Reproduce `git commit --cleanup=default`: drop comment lines and everything
 * after the scissors marker, strip trailing whitespace, collapse runs of blank
 * lines, and trim leading/trailing blanks. What comes back is byte-identical to
 * what `git log --format=%B` will print, minus its trailing newline.
 */
export function cleanupMessage(raw) {
  const lines = []
  for (const line of raw.split('\n')) {
    if (/^# -+ >8 -+$/.test(line)) break
    if (line.startsWith('#')) continue
    lines.push(line.replace(/\s+$/, ''))
  }
  while (lines.length > 0 && lines[0] === '') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.filter((line, i) => line !== '' || lines[i - 1] !== '').join('\n')
}

/**
 * @returns {{ errors: string[], warnings: string[], message: string }}
 */
export function checkCommitMessage(raw) {
  const message = cleanupMessage(raw)
  const errors = []
  const warnings = []

  if (message === '' || GENERATED.test(message)) return { errors, warnings, message }

  const lines = message.split('\n')
  const [subject] = lines

  // `+ 1` for the newline Git stores after the final line, which counts against
  // the same 1024 the EAS payload is measured on.
  const length = message.length + 1
  if (length > MAX_MESSAGE) {
    errors.push(
      `message is ${length} characters; EAS rejects a build/update message over ${MAX_MESSAGE}. ` +
        `Cut ${length - MAX_MESSAGE} — the body should carry the decision and the why, not a diff summary.`,
    )
  }

  if (subject.length > MAX_SUBJECT) {
    errors.push(`subject is ${subject.length} characters; keep it to ${MAX_SUBJECT}.`)
  }

  if (!SUBJECT.test(subject)) {
    errors.push(
      `subject must be \`type(scope): summary\` with type one of ${TYPES.join(', ')} ` +
        '(append `!` for a breaking change).',
    )
  }

  if (/\.$/.test(subject)) {
    errors.push('subject must not end with a period.')
  }

  if (lines.length > 1 && lines[1] !== '') {
    errors.push('line 2 must be blank — Git treats the first paragraph as the subject.')
  }

  for (const [i, line] of lines.entries()) {
    if (i === 0 || line.length <= MAX_BODY_LINE || UNWRAPPABLE.test(line)) continue
    warnings.push(`line ${i + 1} is ${line.length} characters; wrap the body at ${MAX_BODY_LINE}.`)
  }

  return { errors, warnings, message }
}

/**
 * Decoys: each must be REJECTED for the stated reason. A checker that silently
 * stops enforcing a rule is worse than no checker, and there is no test file to
 * catch that here.
 */
const DECOYS = [
  ['fix: subject that is far too long', `fix(x): ${'a'.repeat(MAX_SUBJECT)}`],
  ['no conventional type', 'made the thing work again'],
  ['subject ends with a period', 'fix(git): stop the poll from taking a lock.'],
  ['line 2 is not blank', 'fix(git): drop the lock\nthe body starts too early'],
  ['over the EAS limit', `fix(git): drop the lock\n\n${'word '.repeat(250)}`],
  // Comments are stripped, so this one is over the limit only if cleanup ran.
  ['over the limit once comments are stripped', `fix(git): drop the lock\n\n${'w'.repeat(1100)}`],
]
const missed = DECOYS.filter(([, raw]) => checkCommitMessage(raw).errors.length === 0)

/** And these must PASS, so a tightened rule can't start rejecting real history. */
const REAL = [
  'fix(mobile): set ios.supportsTablet — iPad ran in iPhone compat mode\n\nFound on a real iPad Pro 13-inch simulator.\n',
  'feat(worktrees)!: main-first flow\n\nBody.\n',
  'Merge branch "work/fix-review" into main\n',
  'Revert "fix(git): drop the lock"\n\nThis reverts commit abc1234.\n',
  'chore(deps): bump husky to 9.1.7\n\n# Please enter the commit message for your changes.\n# On branch main\n',
]
const falsePositives = REAL.filter((raw) => checkCommitMessage(raw).errors.length > 0)

if (missed.length > 0 || falsePositives.length > 0) {
  console.error('lint-commit-message is broken — it no longer enforces its own rules:\n')
  for (const [why] of missed) console.error(`  accepted a decoy: ${why}`)
  for (const raw of falsePositives) {
    const { errors } = checkCommitMessage(raw)
    console.error(`  rejected valid history: ${JSON.stringify(raw.split('\n')[0])} — ${errors[0]}`)
  }
  process.exit(1)
}

// Imported by nothing today; the decoys above run on every invocation. Only the
// hook passes a path, so `import`ing this module stays side-effect-free.
const [, , messagePath] = process.argv
if (messagePath) {
  const { errors, warnings, message } = checkCommitMessage(readFileSync(messagePath, 'utf8'))

  for (const warning of warnings) console.error(`commit-msg: warning: ${warning}`)

  if (errors.length > 0) {
    console.error('\nCommit message rejected (AGENTS.md rule 3 · close-the-loop skill):\n')
    for (const error of errors) console.error(`  • ${error}`)
    console.error(
      '\n  type(scope): imperative summary, no trailing period, <= 72 chars' +
        '\n  <blank>' +
        '\n  Why the change was made, what it invalidates, the trap it leaves behind.' +
        `\n  Whole message <= ${MAX_MESSAGE} chars (EAS build/update message limit).` +
        `\n\nYour message survives at .git/COMMIT_EDITMSG (${message.length + 1} chars).`,
    )
    process.exit(1)
  }
}
