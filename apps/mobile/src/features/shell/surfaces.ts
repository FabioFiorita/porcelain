import type { Href } from 'expo-router'

import type { ChromeIconName } from '@/components/chrome-glyph'

/**
 * A Worktree's surfaces, named once.
 *
 * This file was `mock-data.ts` and carried 450 lines of screenshot fixtures for the period when
 * the tablet shell was an outer layer with nothing behind it. What is left is the taxonomy the
 * shell actually needs: which surfaces exist, what they are called, what they are drawn with,
 * and where each one opens.
 *
 * **The set is the web rail's set**, in the web rail's order — `apps/web`'s
 * `shell/surface-sidebar.tsx` `SURFACES`. It was four here and six there, and the two that were
 * missing (Git, Canvas) were not missing from the app: they were screens the Worktree list
 * pushed, unknown to the shell, so neither could ever appear in a panel or be reached from the
 * palette. A surface the shell cannot name is a surface the tablet cannot show.
 *
 * Terminal is deliberately absent from both clients. Shells are daemon-wide, not a property of
 * one checkout, so they are a destination of their own (`app/terminals/`).
 */

export type SurfaceId = 'files' | 'changes' | 'history' | 'git' | 'search' | 'canvas'

export type Surface = {
  readonly id: SurfaceId
  readonly label: string
  /** The one-line description, verbatim from the web rail so the two cannot drift. */
  readonly hint: string
  readonly glyph: ChromeIconName
  /** Route inside the Hub stack. Every surface has one — a surface that opens nothing is not one. */
  readonly route: Href
}

/**
 * Presentation order, matching the web rail. These are not tabs: on a phone a surface is a
 * screen inside the Hub stack, reached from the Worktree that owns it; on a tablet it is a tab
 * of the trailing Surfaces panel, beside the viewer it opens into.
 */
export const SURFACES: readonly Surface[] = [
  {
    id: 'files',
    label: 'Files',
    hint: 'Browse the project tree',
    glyph: 'folder',
    route: '/files',
  },
  {
    id: 'changes',
    label: 'Changes',
    hint: 'Review working-tree changes',
    glyph: 'branch',
    route: '/changes',
  },
  {
    id: 'history',
    label: 'History',
    hint: 'Inspect commit history',
    glyph: 'copy',
    route: '/history',
  },
  {
    id: 'git',
    label: 'Git',
    hint: 'Commands, suggestions, and commit',
    glyph: 'commit',
    route: '/git',
  },
  {
    id: 'search',
    label: 'Search',
    hint: 'Search code and files',
    glyph: 'search',
    route: '/search',
  },
  {
    id: 'canvas',
    label: 'Canvas',
    hint: 'Agent-authored explanation for this Project',
    glyph: 'layers',
    route: '/canvas',
  },
]

export function surfaceById(id: SurfaceId): Surface {
  return SURFACES.find((surface) => surface.id === id) ?? SURFACES[0]
}
