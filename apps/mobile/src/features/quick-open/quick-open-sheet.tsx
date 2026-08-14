import type { ActionView } from '@porcelain/contracts/actions'
import type { Commit } from '@porcelain/contracts/git'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import { EmptyNote, ErrorNote } from '@/components/panel-chrome'
import { ShellModal, useShellModalSize } from '@/components/shell-modal'
import { SURFACE_ROW } from '@/components/surface-layout'
import { Input } from '@/components/ui/input'
import { pathTestId } from '@/lib/path-identities'
import { cn } from '@/lib/utils'

import type { QuickOpenFile, QuickOpenGotoRow } from './quick-open-matching'
import { useQuickOpen } from './use-quick-open'

export function QuickOpenSheet({
  maxWidth,
  onClose,
  open,
}: {
  maxWidth: number
  onClose: () => void
  open: boolean
}): React.JSX.Element {
  const { maxHeight } = useShellModalSize()
  const model = useQuickOpen(open, onClose)
  const trimmed = model.query.trim()

  return (
    <ShellModal
      bare
      hideHeader
      open={open}
      onClose={onClose}
      contentStyle={{ width: maxWidth, maxHeight }}
    >
      <View className="flex-row items-center gap-2 border-b border-border px-3 py-1 pr-12">
        <ChromeGlyph name="search" size={16} />
        <Input
          accessibilityLabel="Quick open files, commands, commits, or surfaces"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={open}
          className="native:h-12 flex-1 border-0 bg-transparent px-0 text-base shadow-none dark:bg-transparent"
          placeholder="Jump to a file, command, commit, or surface…"
          returnKeyType="search"
          testID="porcelain-quick-open-input"
          value={model.query}
          onChangeText={model.setQuery}
        />
      </View>

      <ScrollView
        className="min-h-0"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        /* nativewind-allow-style: the sheet height is derived from live window metrics. */
        style={{ maxHeight: maxHeight - 72 }}
        contentContainerClassName="gap-0.5 py-1.5 pb-3"
        testID="porcelain-quick-open"
      >
        {model.error === null ? null : (
          <View className="px-3 pb-2" testID="porcelain-quick-open-error">
            <ErrorNote message={model.error.message} testID="porcelain-quick-open-error-note" />
          </View>
        )}

        {trimmed === '' ? (
          <EmptyNote
            body="Name a file, saved command, recent commit, or surface to jump there. For content, hand the query to Search."
            testID="porcelain-quick-open-idle"
            title="Quick open"
          />
        ) : (
          <>
            {model.searching ? (
              <Text
                className="px-4 py-2 text-xs text-muted-foreground"
                testID="porcelain-quick-open-searching"
              >
                Searching…
              </Text>
            ) : null}

            {model.noResults ? (
              <EmptyNote
                body="Try a path, command name, commit SHA, or surface."
                testID="porcelain-quick-open-empty"
                title={`No direct matches for “${trimmed}”`}
              />
            ) : null}

            <QuickOpenFileGroup
              labelled={model.labelled}
              rows={model.files}
              onOpen={model.openFile}
            />
            <QuickOpenCommandGroup
              labelled={model.labelled}
              rows={model.commands}
              onOpen={model.openCommand}
            />
            <QuickOpenCommitGroup
              labelled={model.labelled}
              rows={model.commits}
              onOpen={model.openCommit}
            />
            <QuickOpenGotoGroup
              labelled={model.labelled}
              rows={model.goto}
              onOpen={model.openGoto}
            />

            <Pressable
              accessibilityLabel={`Search contents for ${trimmed}`}
              accessibilityRole="button"
              className={cn(SURFACE_ROW, 'min-h-12 flex-row items-center gap-3')}
              testID="porcelain-quick-open-content-escape"
              onPress={model.searchContents}
            >
              <ChromeGlyph name="code" size={16} tone="muted" />
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                  Search contents for “{trimmed}”
                </Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  Open the Search surface with the query
                </Text>
              </View>
            </Pressable>
          </>
        )}
      </ScrollView>
    </ShellModal>
  )
}

function QuickOpenFileGroup({
  labelled,
  onOpen,
  rows,
}: {
  labelled: boolean
  onOpen: (row: QuickOpenFile) => void
  rows: readonly QuickOpenFile[]
}): React.JSX.Element | null {
  if (rows.length === 0) return null
  return (
    <QuickOpenGroup heading={labelled ? 'Files' : undefined}>
      {rows.map((row) => (
        <QuickOpenRow
          key={`${row.kind}:${row.path}`}
          detail={row.kind === 'dir' ? 'Folder' : 'File'}
          glyph={row.kind === 'dir' ? 'folderFill' : 'file'}
          label={row.path}
          testID={pathTestId('porcelain-quick-open-file', row.path)}
          onPress={() => {
            onOpen(row)
          }}
        />
      ))}
    </QuickOpenGroup>
  )
}

function QuickOpenCommandGroup({
  labelled,
  onOpen,
  rows,
}: {
  labelled: boolean
  onOpen: (row: ActionView) => void
  rows: readonly ActionView[]
}): React.JSX.Element | null {
  if (rows.length === 0) return null
  return (
    <QuickOpenGroup heading={labelled ? 'Commands' : undefined}>
      {rows.map((row) => (
        <QuickOpenRow
          key={row.id}
          detail={row.command}
          glyph="terminal"
          label={row.title}
          testID={`porcelain-quick-open-command-${row.id}`}
          onPress={() => {
            onOpen(row)
          }}
        />
      ))}
    </QuickOpenGroup>
  )
}

function QuickOpenCommitGroup({
  labelled,
  onOpen,
  rows,
}: {
  labelled: boolean
  onOpen: (row: Commit) => void
  rows: readonly Commit[]
}): React.JSX.Element | null {
  if (rows.length === 0) return null
  return (
    <QuickOpenGroup heading={labelled ? 'Commits' : undefined}>
      {rows.map((row) => (
        <QuickOpenRow
          key={row.hash}
          detail={row.hash.slice(0, 7)}
          glyph="commit"
          label={row.subject}
          testID={`porcelain-quick-open-commit-${row.hash}`}
          onPress={() => {
            onOpen(row)
          }}
        />
      ))}
    </QuickOpenGroup>
  )
}

function QuickOpenGotoGroup({
  labelled,
  onOpen,
  rows,
}: {
  labelled: boolean
  onOpen: (row: QuickOpenGotoRow) => void
  rows: readonly QuickOpenGotoRow[]
}): React.JSX.Element | null {
  if (rows.length === 0) return null
  return (
    <QuickOpenGroup heading={labelled ? 'Go to…' : undefined}>
      {rows.map((row) => (
        <QuickOpenRow
          key={row.id}
          detail={row.detail}
          glyph={row.kind === 'settings' ? 'settings' : 'chevronRight'}
          label={row.label}
          testID={`porcelain-quick-open-goto-${row.id.replace(':', '-')}`}
          onPress={() => {
            onOpen(row)
          }}
        />
      ))}
    </QuickOpenGroup>
  )
}

function QuickOpenGroup({
  children,
  heading,
}: {
  children: React.ReactNode
  heading?: string
}): React.JSX.Element {
  return (
    <View className="gap-0.5 px-1 py-1">
      {heading === undefined ? null : (
        <Text className="px-3 py-1.5 text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
          {heading}
        </Text>
      )}
      {children}
    </View>
  )
}

function QuickOpenRow({
  detail,
  glyph,
  label,
  onPress,
  testID,
}: {
  detail: string
  glyph: ChromeIconName
  label: string
  onPress: () => void
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`${label}, ${detail}`}
      accessibilityRole="button"
      className={cn(SURFACE_ROW, 'min-h-12 flex-row items-center gap-3')}
      testID={testID}
      onPress={onPress}
    >
      <ChromeGlyph name={glyph} size={16} tone="muted" />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {label}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </Pressable>
  )
}
