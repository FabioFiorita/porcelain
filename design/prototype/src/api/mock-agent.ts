import type { CommentThread } from '../contracts/comments';

/**
 * Canned agent messages so threads can be exercised end to end. The live app
 * gets these from the agent over MCP, when the reviewer asks it in its session.
 */
export function agentAnswer(thread: CommentThread): string {
  const asked = thread.messages.at(-1)?.body.toLowerCase() ?? '';
  if (thread.anchor.kind === 'worktree') {
    return asked.includes('changelog')
      ? 'Done: `CHANGELOG.md` now says ticks are per worktree and clear when the code changes. It is in the list of changes, not explained by a layer, so you can read it on its own.'
      : 'Noted for the whole branch. I will do it before handing off again and say so in the summary.';
  }
  const path = thread.anchor.filePath;

  if (thread.anchor.revision != null) {
    const commit = thread.anchor.revision.slice(0, 7);
    const where =
      thread.anchor.kind === 'file'
        ? path.split('/').pop()
        : `lines ${thread.anchor.startLine}–${thread.anchor.endLine}`;
    return `In ${commit}, this (${where}) was the smallest step that kept the tests green. It is not what the worktree has now; later commits reshaped it. Want me to explain what changed since?`;
  }

  if (asked.includes('why')) {
    return `Because the alternative moves the decision out of ${path.split('/').pop()}. Keeping it here means one place owns the rule, and the tests in the handoff pin it down.`;
  }
  if (asked.includes('migration') || asked.includes('migrate')) {
    return 'Not yet: existing rows would be dropped rather than migrated, since a project-scoped tick cannot be mapped to one worktree honestly. I can add a one-off migration if you want the old ticks kept.';
  }
  if (thread.anchor.kind === 'file') {
    return `This file only renders; state lives one level up. If that split feels wrong, say which part should move and I will do it in the next turn.`;
  }
  return `Good catch on lines ${thread.anchor.startLine}–${thread.anchor.endLine}. It is intentional, but it deserves a comment in the code. I will add one in the next turn.`;
}

/** What the agent writes on lines it added when the reviewer asks how something was done. */
export function agentWalkthrough(
  path: string,
  lines: readonly string[],
): string {
  const code = lines.join('\n');
  const name = path.split('/').pop();

  if (/sqliteTable|index\(|text\(/.test(code)) {
    return `How this was done: the table is declared with Drizzle and keyed by worktree, not project. The index is what keeps the reviewed list for one worktree a single lookup; the migration is generated from this file, nothing is written by hand.`;
  }
  if (/z\.(object|enum|string|array)/.test(code)) {
    return `How this was done: the shape is declared once with Zod and the types are inferred from it (\`z.infer\`), so the server validates and the client types against these exact lines. Nothing else in ${name} restates them.`;
  }
  if (/CodeView|useRef|options/.test(code)) {
    return `How this was done: the options live outside the component, so CodeView gets the same object on every render and never re-lays out the diff. Threads come in through \`renderAnnotation\`; this file only renders them.`;
  }
  if (/^\s*(\/\*\*|\*|\/\/)/.test(lines[0] ?? '')) {
    return `This comment carries the decision. I wrote it before the code so the rule is visible where it applies; the longer reasoning is in the handoff.`;
  }
  return `How this was done in ${name}: I kept the change to these lines so the rest of the file reads as before. Ask here if you want the alternatives I ruled out.`;
}
