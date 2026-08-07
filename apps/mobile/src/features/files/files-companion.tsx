import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { IconAction, PanelLabel, StatusNote } from '@/components/panel-chrome'
import { Textarea } from '@/components/ui/textarea'
import { useShellStore } from '@/features/shell/shell-store'
import { useIsTablet } from '@/features/shell/use-app-window'
import { useActiveRepo } from '@/lib/daemon/repo'
import { cn } from '@/lib/utils'

import { pathSegments, pathTestId } from './file-paths'
import { useFilesStore } from './files-store'
import { type FileEntry, usePathScope, usePinnedEntries, useRepoNotes } from './use-files'

/**
 * The Files companion — "Pinned & notes", the same pair the web rail carries.
 *
 * One component for both hosts, the tablet inspector column and the phone's bolt sheet, so the
 * two can never drift into different companions for the same surface.
 */
export function FilesCompanion({ active }: { active: boolean }): React.JSX.Element {
  const repo = useActiveRepo()

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-5 px-4 pb-8 pt-3"
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      testID="porcelain-files-companion"
    >
      <PinnedCard active={active} />
      {/* Remount per repo so the editor loads that repo's notes rather than carrying a draft
          across a repo switch. */}
      <NotesCard key={repo?.path ?? 'none'} active={active} />
    </ScrollView>
  )
}

/**
 * The repo's pinned paths. Pinning is how a monorepo gets a short list of the places you
 * actually work — the tab's own bookmarks, stored per repo on the daemon rather than here.
 */
function PinnedCard({ active }: { active: boolean }): React.JSX.Element {
  const { entries, error } = usePinnedEntries(active)
  const { unpin } = usePathScope()
  const openDir = useFilesStore((state) => state.openDir)
  const openFile = useFilesStore((state) => state.openFile)
  const closeSheet = useShellStore((state) => state.closeSheet)
  const isTablet = useIsTablet()
  const router = useRouter()
  const [actionError, setActionError] = useState<string | null>(null)

  // The same card hosted two ways: an always-on inspector column beside the tree, and a sheet
  // over the phone's tab. The tablet moves its columns' cursor; the phone dismisses itself and
  // pushes, because a sheet that stays open over the file it just opened is a sheet in the way.
  const open = (entry: FileEntry): void => {
    if (isTablet) {
      if (entry.kind === 'dir') openDir(entry.path)
      else openFile(entry.path)
      return
    }
    closeSheet()
    router.push({
      params: { path: pathSegments(entry.path) },
      pathname: entry.kind === 'dir' ? '/folder/[...path]' : '/file/[...path]',
    })
  }

  return (
    <View className="gap-2" testID="porcelain-files-pinned">
      <PanelLabel>{entries.length > 0 ? `Pinned · ${entries.length}` : 'Pinned'}</PanelLabel>

      {error !== null ? (
        <Text className="text-[11px] leading-4 text-destructive">{error.message}</Text>
      ) : entries.length === 0 ? (
        <Text className="text-[11px] leading-4 text-muted-foreground">
          Long-press a file or folder in the tree and pin it. Pins are per repo and shared with the
          desktop app.
        </Text>
      ) : (
        <View className="gap-1">
          {entries.map((entry) => (
            <View key={entry.path} className="flex-row items-center gap-1">
              <Pressable
                accessibilityLabel={`Open ${entry.path}`}
                accessibilityRole="button"
                className="min-h-10 min-w-0 flex-1 flex-row items-center gap-2 rounded-xl px-2 py-1.5 active:bg-accent"
                testID={pathTestId('porcelain-files-pinned-entry', entry.path)}
                onPress={() => {
                  open(entry)
                }}
              >
                <ChromeGlyph
                  name={entry.kind === 'dir' ? 'folderFill' : 'file'}
                  size={14}
                  tone={entry.kind === 'dir' ? 'primary' : 'muted'}
                />
                <View className="min-w-0 flex-1">
                  <Text className="font-mono text-xs text-foreground" numberOfLines={1}>
                    {entry.name}
                  </Text>
                  <Text
                    className="font-mono text-[10px] text-muted-foreground"
                    ellipsizeMode="head"
                    numberOfLines={1}
                  >
                    {entry.path}
                  </Text>
                </View>
              </Pressable>
              <IconAction
                accessibilityLabel={`Unpin ${entry.name}`}
                glyph="pinOff"
                testID={pathTestId('porcelain-files-unpin', entry.path)}
                onPress={() => {
                  setActionError(null)
                  unpin(entry.path).catch((cause: unknown) => {
                    setActionError(
                      `Unpin failed: ${cause instanceof Error ? cause.message : String(cause)}`,
                    )
                  })
                }}
              />
            </View>
          ))}
        </View>
      )}

      {actionError === null ? null : (
        <StatusNote failed testID="porcelain-files-pinned-error" text={actionError} />
      )}
    </View>
  )
}

/** How long a pause in typing counts as "done", before the note is written to the daemon. */
const AUTOSAVE_DELAY_MS = 800

/**
 * Per-repo quick notes.
 *
 * A plain textarea persisting the same markdown string the desktop's rich editor writes — the
 * two are the same note, and a phone has no room for a formatting toolbar. Autosaved on a
 * pause and flushed on unmount, so nothing is lost to a tab switch.
 */
function NotesCard({ active }: { active: boolean }): React.JSX.Element {
  const { error, isSaving, notes, save } = useRepoNotes(active)
  const [draft, setDraft] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // What the daemon last confirmed, so a flush can tell a real edit from a no-op.
  const saved = useRef<string | null>(null)
  // Read by the unmount cleanup, which must not re-run per keystroke to see the latest text.
  const pending = useRef<string | null>(null)
  // `save` closes over the mutation and is a fresh function every render; the cleanup reads it
  // through a ref so unmount-flush stays a mount-only effect instead of running on each render.
  const saveRef = useRef(save)
  saveRef.current = save

  // Adopt the daemon's copy once, on first read. Later pushes are not adopted: overwriting a
  // half-typed note with the version that was on disk before it is the one unforgivable bug
  // for a notes field.
  useEffect(() => {
    if (notes !== undefined && saved.current === null) {
      saved.current = notes
      setDraft(notes)
    }
  }, [notes])

  // Nothing typed may be lost to a tab switch, a sheet dismissal, or a repo change — all of
  // which unmount this card while the debounce is still pending.
  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current)
      const next = pending.current
      if (next === null || next === saved.current) return
      saved.current = next
      pending.current = null
      saveRef.current(next).catch(() => {
        // Nothing is mounted to report to any more; the draft stays on the daemon's last copy.
      })
    }
  }, [])

  const handleChange = (next: string): void => {
    setDraft(next)
    pending.current = next
    setFailure(null)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (next === saved.current) return
      saved.current = next
      pending.current = null
      save(next).catch((cause: unknown) => {
        setFailure(cause instanceof Error ? cause.message : String(cause))
      })
    }, AUTOSAVE_DELAY_MS)
  }

  const message = failure ?? (error === null ? null : error.message)

  return (
    <View className="gap-2" testID="porcelain-files-notes">
      <View className="flex-row items-center justify-between gap-1">
        <PanelLabel>Notes</PanelLabel>
        {isSaving ? <Text className="text-[10px] text-muted-foreground">Saving…</Text> : null}
      </View>

      {notes === undefined && draft === null ? (
        <Text className="text-[11px] leading-4 text-muted-foreground">Loading…</Text>
      ) : (
        <Textarea
          accessibilityLabel="Repo notes"
          className={cn('min-h-28 font-mono text-xs')}
          placeholder="Write a note…"
          testID="porcelain-files-notes-input"
          value={draft ?? ''}
          onChangeText={handleChange}
        />
      )}

      {message === null ? null : (
        <StatusNote failed testID="porcelain-files-notes-error" text={message} />
      )}
    </View>
  )
}
