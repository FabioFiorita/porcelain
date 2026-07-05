/**
 * When is it safe to type an action's `initialInput` into a fresh shell? Input written
 * before the shell's readline has prepped the tty is echoed by the kernel but DISCARDED
 * when readline takes over (its terminal prep flushes queued typeahead) — so the command
 * never runs. Writing at spawn failed two release gates (v0.17.1, v0.19.0), and writing
 * on the shell's FIRST output failed a third (2026-07-05): the first chunk is bash's
 * startup banner, printed before readline is up, so the write was still swallowed on a
 * slow runner.
 *
 * The reliable signal that readline is up is the PROMPT: it's the last thing the shell
 * prints before going quiet, and the only output whose tail has NO trailing newline (the
 * cursor parks after "$ "). So the write is scheduled per output chunk as a debounce:
 * a prompt-shaped tail arms a short quiet window; a newline-terminated tail (banner /
 * profile output — readline may not be up yet) arms a long one, which a later chunk
 * (the prompt) replaces. A shell that prints nothing at all is covered by the caller's
 * initial fallback timer of QUIET_AFTER_NEWLINE_MS from spawn.
 */

/** Quiet window after a chunk whose tail looks like a prompt (no trailing newline). */
export const QUIET_AFTER_PROMPT_MS = 300
/** Quiet window after a newline-terminated chunk — no prompt seen yet, stay cautious. */
export const QUIET_AFTER_NEWLINE_MS = 2000

/** How long the shell must stay quiet after `chunk` before initialInput is written. */
export function initialInputQuietDelay(chunk: string): number {
  return chunk.endsWith('\n') ? QUIET_AFTER_NEWLINE_MS : QUIET_AFTER_PROMPT_MS
}
