/**
 * The daemon returns a commit's raw `%B`, so the subject is the first line and the body is
 * whatever follows the blank line under it.
 */
export type CommitMessage = { subject: string; body: string }

export function splitCommitMessage(message: string): CommitMessage {
  const newline = message.indexOf('\n')
  if (newline === -1) return { body: '', subject: message.trim() }
  return {
    // Leading blank lines under the subject are conventional separators, not body content.
    body: message
      .slice(newline + 1)
      .replace(/^\n+/, '')
      .trimEnd(),
    subject: message.slice(0, newline).trim(),
  }
}

/** Abbreviated hash, as every git surface prints it. */
export function shortHash(hash: string): string {
  return hash.slice(0, 7)
}

/**
 * What a commit is titled by. Falls back to the short hash: a message can be empty, and a
 * blank title would leave the screen with nothing to identify the commit at all.
 */
export function commitTitle(message: string | undefined, hash: string): string {
  const subject = message === undefined ? '' : splitCommitMessage(message).subject
  return subject === '' ? shortHash(hash) : subject
}
