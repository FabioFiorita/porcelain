import type {
  CompletionItem,
  Diagnostic,
  HoverInfo,
  LspPosition,
  RenamePrep,
  SymbolLocation,
  TextEdit,
} from '@main/lsp'
import { isLspLang } from '@renderer/lib/lsp-position'
import { relativeTo } from '@renderer/lib/paths'
import { trpc } from '@renderer/lib/trpc'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useCallback, useEffect, useRef } from 'react'

// The renderer half of the opt-in TS language server. Everything here is inert
// unless a caller passes `enabled === true` (which is `lspEnabled && isLspLang`):
// queries stay disabled, the doc-sync effect early-returns, and the imperative
// actions short-circuit to empty results — so when the feature is off no LSP
// request ever crosses IPC and the server never spawns.
//
// All tRPC lives here (components can't import the trpc proxy), matching the
// `use-files` idiom: declarative state via `useQuery`, fire-and-forget writes via
// `useMutation().mutate`, and imperative reads via `useUtils().*.fetch`.

const DID_CHANGE_DEBOUNCE_MS = 300

/** `lspEnabled` AND the file is a language the server understands. The single gate
 *  every other LSP path is guarded by. Fine-grained selector so toggling unrelated
 *  prefs doesn't re-render callers. */
export function useLspEnabledFor(path: string): boolean {
  const lspEnabled = usePreferencesStore((s) => s.lspEnabled)
  return lspEnabled && isLspLang(path)
}

/**
 * Mirror an open document into the server's text sync: `didOpen` once on mount,
 * a DEBOUNCED `didChange` on every `content` change, and `didClose` on unmount.
 * Fire-and-forget — these mutations have no UI; hover/definition/diagnostics read
 * the synced buffer. Entirely no-op when `!enabled || !repo`.
 */
export function useLspDocSync(
  repo: string | undefined,
  absPath: string,
  content: string,
  enabled: boolean,
): void {
  const didOpen = trpc.lspDidOpen.useMutation()
  const didChange = trpc.lspDidChange.useMutation()
  const didClose = trpc.lspDidClose.useMutation()

  // Hold the latest mutate fns + content in refs so the open/close lifecycle effect
  // depends only on identity that's actually stable, and never re-fires didOpen on a
  // keystroke. (tRPC mutate fns are stable, but routing through refs keeps the deps
  // honest and the effect a true mount/unmount pair.)
  const active = enabled && repo !== undefined
  const relPath = repo !== undefined ? relativeTo(repo, absPath) : absPath
  const latest = useRef({ repo, relPath, content, didOpen, didChange, didClose })
  latest.current = { repo, relPath, content, didOpen, didChange, didClose }

  // Open on mount / when the doc identity (repo+path) or active-ness flips on;
  // close on unmount or when it flips off. Keyed on the document, NOT on content.
  useEffect(() => {
    if (!active || repo === undefined) return
    const { didOpen: open, didClose: close } = latest.current
    open.mutate({ repo, path: relPath, content: latest.current.content })
    return () => {
      close.mutate({ repo, path: relPath })
    }
  }, [active, repo, relPath])

  // Debounced didChange on content edits. Skipped while inactive; the timer is
  // cleared on every change so only the trailing edit syncs.
  useEffect(() => {
    if (!active || repo === undefined) return
    const handle = setTimeout(() => {
      latest.current.didChange.mutate({ repo, path: relPath, content })
    }, DID_CHANGE_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [active, repo, relPath, content])
}

/**
 * The diagnostics for an open document. Repo-keyed and invalidated by the
 * `diagnostics` app-event; returns `[]` whenever the feature is off so callers can
 * render unconditionally. `placeholderData` keeps the previous list visible across
 * an invalidation refetch instead of flashing empty.
 */
export function useDiagnostics(
  repo: string | undefined,
  absPath: string,
  enabled: boolean,
): Diagnostic[] {
  const relPath = repo !== undefined ? relativeTo(repo, absPath) : absPath
  const { data } = trpc.lspDiagnostics.useQuery(
    { repo: repo ?? '', path: relPath },
    { enabled: enabled && repo !== undefined, placeholderData: (prev) => prev },
  )
  return enabled ? (data ?? []) : []
}

/**
 * Declarative references for the symbol at `pos` in `absPath`. Unlike
 * `useLspActions().references` (imperative, fired on a gesture), this drives the
 * `references` viewer tab: the tab carries the position and the view reads its
 * result here. Gated by `enabled` (the same `lspEnabled && isLspLang` gate as the
 * rest) so a references tab opened while LSP was on goes inert if the user later
 * toggles the feature off — otherwise revisiting that persisted tab would fire a
 * query and respawn the server while the feature is "off". `path` is repo-relative.
 */
export function useReferencesQuery(
  repo: string | undefined,
  absPath: string,
  pos: { line: number; character: number },
  enabled: boolean,
): { references: SymbolLocation[]; isLoading: boolean } {
  const { data, isLoading } = trpc.lspReferences.useQuery(
    {
      repo: repo ?? '',
      path: relativeTo(repo, absPath),
      line: pos.line,
      character: pos.character,
    },
    { enabled: enabled && !!repo },
  )
  return { references: enabled ? (data ?? []) : [], isLoading }
}

export interface LspActions {
  hover: (pos: LspPosition) => Promise<HoverInfo | null>
  definition: (pos: LspPosition) => Promise<SymbolLocation[]>
  typeDefinition: (pos: LspPosition) => Promise<SymbolLocation[]>
  implementation: (pos: LspPosition) => Promise<SymbolLocation[]>
  references: (pos: LspPosition) => Promise<SymbolLocation[]>
  completion: (pos: LspPosition) => Promise<CompletionItem[]>
}

/**
 * Imperative LSP reads, triggered by pointer/keyboard (hover, Cmd+click) rather
 * than declaratively. Uses `useUtils().*.fetch` so a request fires on demand and
 * dedupes through the query cache. Each callback resolves to its empty value when
 * `repo` is missing, so callers never special-case the no-repo state.
 */
export function useLspActions(repo: string | undefined, absPath: string): LspActions {
  const utils = trpc.useUtils()
  const relPath = repo !== undefined ? relativeTo(repo, absPath) : absPath

  const hover = useCallback(
    (pos: LspPosition): Promise<HoverInfo | null> => {
      if (repo === undefined) return Promise.resolve(null)
      return utils.lspHover.fetch({
        repo,
        path: relPath,
        line: pos.line,
        character: pos.character,
      })
    },
    [utils, repo, relPath],
  )

  const definition = useCallback(
    (pos: LspPosition): Promise<SymbolLocation[]> => {
      if (repo === undefined) return Promise.resolve([])
      return utils.lspDefinition.fetch({
        repo,
        path: relPath,
        line: pos.line,
        character: pos.character,
      })
    },
    [utils, repo, relPath],
  )

  const typeDefinition = useCallback(
    (pos: LspPosition): Promise<SymbolLocation[]> => {
      if (repo === undefined) return Promise.resolve([])
      return utils.lspTypeDefinition.fetch({
        repo,
        path: relPath,
        line: pos.line,
        character: pos.character,
      })
    },
    [utils, repo, relPath],
  )

  const implementation = useCallback(
    (pos: LspPosition): Promise<SymbolLocation[]> => {
      if (repo === undefined) return Promise.resolve([])
      return utils.lspImplementation.fetch({
        repo,
        path: relPath,
        line: pos.line,
        character: pos.character,
      })
    },
    [utils, repo, relPath],
  )

  const references = useCallback(
    (pos: LspPosition): Promise<SymbolLocation[]> => {
      if (repo === undefined) return Promise.resolve([])
      return utils.lspReferences.fetch({
        repo,
        path: relPath,
        line: pos.line,
        character: pos.character,
      })
    },
    [utils, repo, relPath],
  )

  const completion = useCallback(
    (pos: LspPosition): Promise<CompletionItem[]> => {
      if (repo === undefined) return Promise.resolve([])
      return utils.lspCompletion.fetch({
        repo,
        path: relPath,
        line: pos.line,
        character: pos.character,
      })
    },
    [utils, repo, relPath],
  )

  return { hover, definition, typeDefinition, implementation, references, completion }
}

/**
 * Imperative formatting for an open document. `format` syncs the live buffer to the
 * server and returns the edits to apply to it (the caller splices them into its
 * buffer via `applyTextEdits`). Resolves to `[]` when `repo` is missing so callers
 * never special-case the no-repo state. `absPath` is converted to repo-relative here.
 */
export function useLspFormat(
  repo: string | undefined,
  absPath: string,
): {
  format: (
    content: string,
    options: { tabSize: number; insertSpaces: boolean },
  ) => Promise<TextEdit[]>
} {
  const relPath = repo !== undefined ? relativeTo(repo, absPath) : absPath
  const mutation = trpc.lspFormatting.useMutation()
  const format = useCallback(
    (content: string, options: { tabSize: number; insertSpaces: boolean }): Promise<TextEdit[]> => {
      if (repo === undefined) return Promise.resolve([])
      return mutation.mutateAsync({
        repo,
        path: relPath,
        content,
        tabSize: options.tabSize,
        insertSpaces: options.insertSpaces,
      })
    },
    [mutation, repo, relPath],
  )
  return { format }
}

export interface LspRename {
  prepareRename: (pos: LspPosition) => Promise<RenamePrep | null>
  rename: (
    pos: LspPosition,
    newName: string,
    buffers: { path: string; content: string }[],
  ) => Promise<{ changedPaths: string[]; updatedContent: Record<string, string> }>
}

/**
 * Imperative rename for the symbol at a position. `prepareRename` probes whether the
 * symbol is renamable (and seeds the input); `rename` performs it, writing the
 * WorkspaceEdit to disk in main, then invalidates the read/diff/flow queries for every
 * changed path — mirroring `useWriteTextFile`, since a rename is just a multi-file
 * write that moves git state. `absPath` is converted to repo-relative here.
 */
export function useLspRename(repo: string | undefined, absPath: string): LspRename {
  const utils = trpc.useUtils()
  const relPath = repo !== undefined ? relativeTo(repo, absPath) : absPath
  const mutation = trpc.lspRename.useMutation({
    onSuccess: async (data) => {
      // A rename touches several files plus git's working tree (every renamed
      // occurrence is a change) — invalidate per changed path, then flow + diff once.
      await Promise.all([
        ...data.changedPaths.map((path) => utils.readFile.invalidate(path)),
        utils.gitDiffFile.invalidate(),
        utils.gitFlow.invalidate(),
      ])
    },
  })

  const prepareRename = useCallback(
    (pos: LspPosition): Promise<RenamePrep | null> => {
      if (repo === undefined) return Promise.resolve(null)
      return utils.lspPrepareRename.fetch({
        repo,
        path: relPath,
        line: pos.line,
        character: pos.character,
      })
    },
    [utils, repo, relPath],
  )

  const rename = useCallback(
    (
      pos: LspPosition,
      newName: string,
      buffers: { path: string; content: string }[],
    ): Promise<{ changedPaths: string[]; updatedContent: Record<string, string> }> => {
      if (repo === undefined) return Promise.resolve({ changedPaths: [], updatedContent: {} })
      return mutation.mutateAsync({
        repo,
        path: relPath,
        line: pos.line,
        character: pos.character,
        newName,
        buffers,
      })
    },
    [mutation, repo, relPath],
  )

  return { prepareRename, rename }
}
