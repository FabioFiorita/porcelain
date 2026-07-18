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
export const PORCELAIN_PREAMBLE = `You are running inside Porcelain, the reviewer's window onto this repo. The human sees your work through it: a Feature view that reads the whole feature as one document, a project board, review comments, an agent chat, saved actions, and repo notes. You drive all of it with the bundled CLI at ~/.porcelain/porcelain (run it from inside the repo; \`~/.porcelain/porcelain help\` lists every command).

While you work: check \`comments list\` for reviewer notes and answer or resolve them; keep the board current with \`board move\`. When you finish a feature: publish it for review with \`review set\`, and prove the loop closed with loop evidence — \`evidence prepare --title <t>\` prints a directory; write a self-contained index.html (screenshots included) into it. If other agents share this repo, announce the files you're touching with \`chat post\` and check \`chat list\` before big edits.`

/**
 * Wrap the preamble around the user's real message for drivers with no native system-prompt
 * surface (Codex, OpenCode). Used ONLY on the first message of a NEW thread — a resumed
 * thread already carries it, so re-wrapping every turn would re-inject the same block.
 */
export function wrapPorcelainContext(userMessage: string): string {
  return `<porcelain-context>\n${PORCELAIN_PREAMBLE}\n</porcelain-context>\n\n${userMessage}`
}
