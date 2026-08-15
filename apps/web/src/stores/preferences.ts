import { type CommitModel, commitModelSchema } from '@porcelain/contracts'
import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const changesScopeSchema = z.enum(['working', 'branch'])
/** Appearance preference. `system` follows the OS `prefers-color-scheme`. */
const themeModeSchema = z.enum(['system', 'light', 'dark'])
const diffModeSchema = z.enum(['unified', 'split'])
const markdownModeSchema = z.enum(['reader', 'source'])
const htmlModeSchema = z.enum(['preview', 'source'])
const pullModeSchema = z.enum(['merge', 'rebase'])
const sidebarTabSchema = z.enum(['files', 'changes', 'history', 'review', 'board', 'search'])

export type ChangesScope = z.infer<typeof changesScopeSchema>
export type ThemeMode = z.infer<typeof themeModeSchema>
export type DiffMode = z.infer<typeof diffModeSchema>
export type MarkdownMode = z.infer<typeof markdownModeSchema>
export type HtmlMode = z.infer<typeof htmlModeSchema>
export type PullMode = z.infer<typeof pullModeSchema>
export type SidebarTab = z.infer<typeof sidebarTabSchema>

export const SIDEBAR_MIN_WIDTH = 320
export const RIGHT_SIDEBAR_MIN_WIDTH = 280
export const SIDEBAR_MAX_WIDTH = 520
export const NOTES_MIN_HEIGHT = 100
export const NOTES_MAX_HEIGHT = 600
export const SPLIT_MIN_RATIO = 0.2
export const SPLIT_MAX_RATIO = 0.8

const clampRightSidebarWidth = (width: number): number =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(RIGHT_SIDEBAR_MIN_WIDTH, width))
const clampSidebarWidth = (width: number): number =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width))
const clampNotesHeight = (height: number): number =>
  Math.min(NOTES_MAX_HEIGHT, Math.max(NOTES_MIN_HEIGHT, height))
const clampSplitRatio = (ratio: number): number =>
  Math.min(SPLIT_MAX_RATIO, Math.max(SPLIT_MIN_RATIO, ratio))

/**
 * Per-field fallback, expressed in the schema.
 *
 * `optional().catch(undefined)` is what makes ONE stale enum cost only that field: a
 * window whose `theme` was written by a build that still had `sepia` keeps its sidebar
 * width. Whole-object parsing would have thrown the good fields away with the bad one.
 */
function persistedField<Schema extends z.ZodType>(schema: Schema) {
  return schema.optional().catch(undefined)
}

/**
 * Persisted layout is a real trust boundary: `localStorage` survives downgrades, hand
 * edits, and every shape this store has ever had, and zustand's `persist` merges whatever
 * it finds straight over the defaults. `z.number()` already rejects `NaN`/`Infinity`, so a
 * corrupt width can no longer reach a CSS dimension; the clamps are the SAME ones the
 * setters apply, so a stale-but-plausible width is pulled back into range rather than
 * dropped.
 *
 * Presentation state stays app-owned — it is not wire vocabulary and does not belong in
 * contracts or client-runtime. `commitModel` is the exception and reuses the canonical
 * `commitModelSchema`, because that value IS sent to the daemon.
 */
const persistedPreferencesSchema = z.object({
  theme: persistedField(themeModeSchema),
  changesScope: persistedField(changesScopeSchema),
  diffMode: persistedField(diffModeSchema),
  markdownMode: persistedField(markdownModeSchema),
  htmlMode: persistedField(htmlModeSchema),
  pullMode: persistedField(pullModeSchema),
  commitModel: persistedField(commitModelSchema),
  rightSidebarOpen: persistedField(z.boolean()),
  rightSidebarWidth: persistedField(z.number().transform(clampRightSidebarWidth)),
  sidebarTab: persistedField(sidebarTabSchema),
  sidebarWidth: persistedField(z.number().transform(clampSidebarWidth)),
  notesHeight: persistedField(z.number().transform(clampNotesHeight)),
  splitRatio: persistedField(z.number().transform(clampSplitRatio)),
  skillsDismissedVersion: persistedField(z.string().nullable()),
})

/** The persisted fields with their optionality removed — `null` stays where it is real. */
type PreferenceValues = {
  [Key in keyof z.infer<typeof persistedPreferencesSchema>]-?: Exclude<
    z.infer<typeof persistedPreferencesSchema>[Key],
    undefined
  >
}

/**
 * Every preference the persisted blob still describes correctly.
 *
 * A blob that is not an object at all keeps every default; within one, an unknown key is
 * ignored, a missing key keeps its default, and an invalid value falls back to the default
 * for that field alone. Assignment is written out per field so a renamed preference is a
 * type error rather than a silently dropped one.
 */
export function hydratePreferences(persisted: unknown): Partial<PreferenceValues> {
  const parsed = persistedPreferencesSchema.safeParse(persisted)
  if (!parsed.success) return {}
  const blob = parsed.data
  const hydrated: Partial<PreferenceValues> = {}
  if (blob.theme !== undefined) hydrated.theme = blob.theme
  if (blob.changesScope !== undefined) hydrated.changesScope = blob.changesScope
  if (blob.diffMode !== undefined) hydrated.diffMode = blob.diffMode
  if (blob.markdownMode !== undefined) hydrated.markdownMode = blob.markdownMode
  if (blob.htmlMode !== undefined) hydrated.htmlMode = blob.htmlMode
  if (blob.pullMode !== undefined) hydrated.pullMode = blob.pullMode
  if (blob.commitModel !== undefined) hydrated.commitModel = blob.commitModel
  if (blob.rightSidebarOpen !== undefined) hydrated.rightSidebarOpen = blob.rightSidebarOpen
  if (blob.rightSidebarWidth !== undefined) hydrated.rightSidebarWidth = blob.rightSidebarWidth
  if (blob.sidebarTab !== undefined) hydrated.sidebarTab = blob.sidebarTab
  if (blob.sidebarWidth !== undefined) hydrated.sidebarWidth = blob.sidebarWidth
  if (blob.notesHeight !== undefined) hydrated.notesHeight = blob.notesHeight
  if (blob.splitRatio !== undefined) hydrated.splitRatio = blob.splitRatio
  if (blob.skillsDismissedVersion !== undefined) {
    hydrated.skillsDismissedVersion = blob.skillsDismissedVersion
  }
  return hydrated
}

interface PreferencesState {
  /** Light/dark/system appearance. Applied pre-paint in main.tsx via lib/theme. */
  theme: ThemeMode
  changesScope: ChangesScope
  diffMode: DiffMode
  markdownMode: MarkdownMode
  /** Default for .html/.htm: sandboxed preview vs source. */
  htmlMode: HtmlMode
  /** Strategy the `git pull` quick command uses (`--no-rebase` vs `--rebase`). */
  pullMode: PullMode
  /** Model used when Porcelain drafts a commit message or commit groups. */
  commitModel: CommitModel
  rightSidebarOpen: boolean
  rightSidebarWidth: number
  sidebarTab: SidebarTab
  sidebarWidth: number
  notesHeight: number
  /** Fraction of the viewer width given to the left pane when split (0.2–0.8). */
  splitRatio: number
  /** Bundled skills version the user last dismissed the upgrade toast for. */
  skillsDismissedVersion: string | null
  setChangesScope: (scope: ChangesScope) => void
  setDiffMode: (mode: DiffMode) => void
  setMarkdownMode: (mode: MarkdownMode) => void
  setHtmlMode: (mode: HtmlMode) => void
  setPullMode: (mode: PullMode) => void
  setCommitModel: (model: CommitModel) => void
  setSidebarTab: (tab: SidebarTab) => void
  setRightSidebarOpen: (open: boolean) => void
  setRightSidebarWidth: (width: number) => void
  setSidebarWidth: (width: number) => void
  setNotesHeight: (height: number) => void
  setSplitRatio: (ratio: number) => void
  setSkillsDismissedVersion: (version: string | null) => void
  setTheme: (theme: ThemeMode) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      changesScope: 'working',
      diffMode: 'unified',
      markdownMode: 'reader',
      htmlMode: 'preview',
      pullMode: 'merge',
      commitModel: 'luna',
      rightSidebarOpen: true,
      rightSidebarWidth: RIGHT_SIDEBAR_MIN_WIDTH,
      sidebarTab: 'files',
      sidebarWidth: 256,
      notesHeight: 220,
      splitRatio: 0.5,
      skillsDismissedVersion: null,
      setChangesScope: (changesScope: ChangesScope) => set({ changesScope }),
      setDiffMode: (diffMode: DiffMode) => set({ diffMode }),
      setMarkdownMode: (markdownMode: MarkdownMode) => set({ markdownMode }),
      setHtmlMode: (htmlMode: HtmlMode) => set({ htmlMode }),
      setPullMode: (pullMode: PullMode) => set({ pullMode }),
      setCommitModel: (commitModel: CommitModel) => set({ commitModel }),
      setSidebarTab: (sidebarTab: SidebarTab) => set({ sidebarTab }),
      setRightSidebarOpen: (rightSidebarOpen: boolean) => set({ rightSidebarOpen }),
      setRightSidebarWidth: (width: number) =>
        set({
          rightSidebarWidth: clampRightSidebarWidth(width),
        }),
      setSidebarWidth: (width: number) => set({ sidebarWidth: clampSidebarWidth(width) }),
      setNotesHeight: (height: number) => set({ notesHeight: clampNotesHeight(height) }),
      setSplitRatio: (ratio: number) => set({ splitRatio: clampSplitRatio(ratio) }),
      setSkillsDismissedVersion: (skillsDismissedVersion: string | null) =>
        set({ skillsDismissedVersion }),
      setTheme: (theme: ThemeMode) => set({ theme }),
    }),
    {
      name: 'porcelain-preferences',
      // The parse belongs here, not in `onRehydrateStorage`: `merge` is what decides which
      // persisted fields ever reach the store, so an invalid one is never briefly live.
      merge: (persisted, current): PreferencesState => ({
        ...current,
        ...hydratePreferences(persisted),
      }),
    },
  ),
)
