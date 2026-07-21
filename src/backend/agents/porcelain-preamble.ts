/**
 * The session preamble every agent spawned from the Agent tab is handed, so it knows it's
 * running inside Porcelain and drives Porcelain's channels (Feature view, project board,
 * review comments, agent chat, saved actions, repo notes) through the bundled
 * `~/.porcelain/porcelain` CLI instead of ignoring them.
 *
 * HOW each driver delivers it (recorded here so the mechanism lives in one place):
 * - Claude   → `--append-system-prompt` on every per-turn spawn (native; a constant string
 *              keeps the system-prompt prefix cache-stable across cold `claude -p --resume`
 *              spawns, the same rationale as `--exclude-dynamic-system-prompt-sections`).
 * - Grok     → `--rules` on every headless spawn (native "extra rules appended to the system
 *              prompt"; constant string, so cache-stable for the same reason).
 * - Codex /
 *   OpenCode → no reliable per-turn system/developer-prompt surface, so
 *              `wrapPorcelainContext` prepends it to the FIRST user message of a NEW thread
 *              only (a resumed thread already carries it — re-sending would re-inject it
 *              every turn).
 *
 * The daemon is Electron-free; this module imports nothing, so every driver can pull it in.
 */
// Kept short on purpose (P4 token audit): this string is appended every Claude/Grok
// turn and wraps the first Codex/OpenCode message. Verbose prose here costs real
// tokens on every turn without changing capability — the CLI `help` is the catalog.
export const PORCELAIN_PREAMBLE = `You run inside Porcelain. Drive it via ~/.porcelain/porcelain (from the repo; \`help\` lists verbs): review set / evidence prepare (+ write index.html in the printed dir), board, comments list/answer/resolve, chat list/post, notes get, layers. Finish features with review set (Intent + Execution files) + evidence (HTML proof). Before big multi-file edits: chat list; claim with chat post --files/--intent; close with --closes.`

/**
 * Wrap the preamble around the user's real message for drivers with no native system-prompt
 * surface (Codex, OpenCode). Used ONLY on the first message of a NEW thread — a resumed
 * thread already carries it, so re-wrapping every turn would re-inject the same block.
 */
export function wrapPorcelainContext(userMessage: string): string {
  return `<porcelain-context>\n${PORCELAIN_PREAMBLE}\n</porcelain-context>\n\n${userMessage}`
}
