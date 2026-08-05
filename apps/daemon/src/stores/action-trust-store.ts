import { createHash } from 'node:crypto'
import { z } from 'zod'
import { createHomeChannel } from '../net/home-channel'

/**
 * Which saved commands this machine's human has accepted, keyed by repo path.
 *
 * Saved actions used to live in `~/.porcelain`, where the only author was the
 * human sitting here. They live in `<repo>/.porcelain/actions.json` now and are
 * Shared by default, so `git clone` can hand you a Run list somebody else wrote —
 * named commands, one click from a login shell. The agent CLI can write them too.
 *
 * What this defends is narrow and worth stating plainly: it stops a human from
 * one-clicking a command they assumed was their own. It is NOT a sandbox. A
 * daemon-side block would be theatre — a credential holder can already open a
 * terminal and type anything (audit: "the token holder IS the user"). The
 * boundary being protected here is the human's attention, so the gate lives
 * where the human is.
 *
 * Deliberately machine-local: trust is this person's judgement on this box, and
 * committing it would let a repo vouch for itself. Keyed by repo path, which
 * fails closed on rename — re-trusting is cheap, mistakenly inheriting is not.
 */

const trustSchema = z.record(z.string(), z.array(z.string()))
type TrustDoc = z.infer<typeof trustSchema>

const channel = createHomeChannel<TrustDoc>({
  envVar: 'PORCELAIN_ACTION_TRUST_FILE',
  fileName: 'action-trust.json',
  schema: trustSchema,
  empty: (): TrustDoc => ({}),
})

/**
 * The command text is what runs, so the command text is what gets trusted. A
 * retitled action keeps its trust (a label cannot execute); an edited command
 * loses it, whoever did the editing.
 */
export function commandFingerprint(command: string): string {
  return createHash('sha256').update(command).digest('hex').slice(0, 32)
}

export async function readTrustedCommands(repoPath: string): Promise<Set<string>> {
  const all = await channel.readAll()
  return new Set(all[repoPath] ?? [])
}

export async function trustCommands(repoPath: string, commands: string[]): Promise<void> {
  const fingerprints = commands.map(commandFingerprint)
  await channel.mutate((all) => {
    const existing = new Set(all[repoPath] ?? [])
    for (const fingerprint of fingerprints) existing.add(fingerprint)
    return { ...all, [repoPath]: [...existing] }
  })
}

/**
 * Grandfather a repo whose actions this human demonstrably wrote — the home→repo
 * migration only ever moves data that was already in `~/.porcelain` on this
 * machine. Without this, everyone who migrated would be asked to re-approve
 * commands they typed themselves, which teaches people to click through the gate.
 */
export async function trustMigratedCommands(repoPath: string, commands: string[]): Promise<void> {
  if (commands.length === 0) return
  await trustCommands(repoPath, commands)
}
