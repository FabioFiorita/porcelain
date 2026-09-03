import { z } from 'zod'

export const pairingBundleEntrySchema = z.object({
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().min(1),
})

export const pairingBundleSchema = z.object({
  environments: z.array(pairingBundleEntrySchema).min(1),
  version: z.literal(1),
})

export type PairingBundleEntry = z.infer<typeof pairingBundleEntrySchema>
export type PairingBundle = z.infer<typeof pairingBundleSchema>

const PREFIX = 'porcelain://pair-environments#bundle='

export function isPairingBundleLink(input: string): boolean {
  return input.trim().startsWith('porcelain://pair-environments')
}

/** One pasteable credential envelope; every nested link remains daemon-issued and single-use. */
export function createPairingBundleLink(entries: readonly PairingBundleEntry[]): string {
  const bundle = pairingBundleSchema.parse({ environments: entries, version: 1 })
  return `${PREFIX}${encodeURIComponent(JSON.stringify(bundle))}`
}

export function parsePairingBundleLink(input: string): PairingBundle | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith(PREFIX)) return null
  try {
    return pairingBundleSchema.parse(JSON.parse(decodeURIComponent(trimmed.slice(PREFIX.length))))
  } catch {
    return null
  }
}
