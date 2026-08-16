/**
 * The shell's destinations. Seven surfaces, named once.
 *
 * This file was `mock-data.ts` and carried 450 lines of screenshot fixtures — list rows,
 * companion sections, viewer placeholders, fake projects and branches — for the period when the
 * tablet shell was an outer layer with nothing behind it. Every surface now has real,
 * daemon-backed panels in `surface-slots.tsx`, so every fixture had become unreachable content
 * still shipping in the production bundle. What is left is the taxonomy the shell actually
 * needs: which destinations exist, what the rail calls them, and what their list column is
 * titled.
 */

export type SurfaceId = 'files' | 'changes' | 'history' | 'search' | 'terminal'

export type Surface = {
  readonly id: SurfaceId
  readonly label: string
  /** Heading over the supplementary (list) column on tablet. */
  readonly listTitle: string
}

/** Rail order. The phone's tabs are a subset of these, paired into dual-face slots. */
export const SURFACES: readonly Surface[] = [
  { id: 'files', label: 'Files', listTitle: 'Files' },
  { id: 'changes', label: 'Changes', listTitle: 'Changes' },
  { id: 'history', label: 'History', listTitle: 'History' },
  { id: 'search', label: 'Search', listTitle: 'Search' },
  { id: 'terminal', label: 'Terminal', listTitle: 'Terminal' },
]

export function surfaceById(id: SurfaceId): Surface {
  return SURFACES.find((surface) => surface.id === id) ?? SURFACES[0]
}
