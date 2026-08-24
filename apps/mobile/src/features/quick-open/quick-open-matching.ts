import type { ActionView } from '@porcelain/contracts/actions'
import type { Commit } from '@porcelain/contracts/git'
import type { SearchResult } from '@porcelain/contracts/search'
import type { SettingsSection } from '@/features/shell/shell-store'
import { SURFACES, type SurfaceId } from '@/features/shell/surfaces'

/** A pasted short or full SHA is the only query shape that searches recent commits. */
export const SHA_QUERY = /^[0-9a-f]{7,40}$/i

export type QuickOpenGotoRow =
  | {
      kind: 'surface'
      id: SurfaceId
      label: string
      detail: 'Surface'
    }
  | {
      kind: 'settings'
      id: `settings:${SettingsSection}`
      label: string
      detail: 'Settings'
      section: SettingsSection
    }

const SETTINGS_ROWS: readonly QuickOpenGotoRow[] = [
  {
    detail: 'Settings',
    id: 'settings:general',
    kind: 'settings',
    label: 'General',
    section: 'general',
  },
  {
    detail: 'Settings',
    id: 'settings:companion',
    kind: 'settings',
    label: 'Companion',
    section: 'companion',
  },
  {
    detail: 'Settings',
    id: 'settings:updates',
    kind: 'settings',
    label: 'Updates',
    section: 'updates',
  },
  {
    detail: 'Settings',
    id: 'settings:remotes',
    kind: 'settings',
    label: 'Remotes',
    section: 'remotes',
  },
]

const GOTO_ROWS: readonly QuickOpenGotoRow[] = [
  ...SURFACES.map((surface) => ({
    detail: 'Surface' as const,
    id: surface.id,
    kind: 'surface' as const,
    label: surface.label,
  })),
  ...SETTINGS_ROWS,
]

/** Saved commands whose title or command text contains the query. */
export function matchCommands(query: string, actions: readonly ActionView[]): ActionView[] {
  const q = query.trim().toLowerCase()
  if (q === '') return []
  return actions
    .filter((action) => action.where !== 'local')
    .filter(
      (action) =>
        action.title.toLowerCase().includes(q) || action.command.toLowerCase().includes(q),
    )
    .slice(0, 5)
}

/** Recent commits whose hash starts with a pasted SHA. */
export function matchCommits(query: string, commits: readonly Commit[]): Commit[] {
  const q = query.trim().toLowerCase()
  if (!SHA_QUERY.test(q)) return []
  return commits.filter((commit) => commit.hash.toLowerCase().startsWith(q)).slice(0, 5)
}

/** Navigation destinations are a small vocabulary, not another command registry. */
export function gotoRows(query: string): QuickOpenGotoRow[] {
  const q = query.trim().toLowerCase()
  if (q === '') return []
  return GOTO_ROWS.filter((row) => row.label.toLowerCase().includes(q))
}

/** Group headings are noise when the palette contains only one kind of result. */
export function groupsLabelled(kinds: number): boolean {
  return kinds > 1
}

export type QuickOpenFile = SearchResult
