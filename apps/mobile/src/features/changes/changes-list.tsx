import { useMemo, useState } from 'react'
import { SectionList, Text, View } from 'react-native'
import { EmptyNote, ErrorNote, IconAction, PanelLabel } from '@/components/panel-chrome'
import { SegmentedControl } from '@/components/ui/segmented-control'
import {
  SURFACE_GUTTER,
  SURFACE_STACK_GAP,
  SURFACE_TOOLBAR,
  surfaceContentStyle,
} from '@/components/surface-layout'
import { type FlowFile, useDiscardFile, useFileStaging } from '@/features/git'
import { useBottomChrome } from '@/features/shell/window-chrome'
import { cn } from '@/lib/utils'
import { type ChangesScope, useChangesStore } from './changes-store'
import { summarizeChanges } from './changes-summary'
import { FileRow, type FileRowActions } from './file-row'
import { useChangesFlow } from './use-changes'

/**
 * The Changes list: the flow-grouped change set for the active scope, with the header that
 * says how much of it has been read and the two bulk actions — tick everything off, or open
 * the whole set as one continuous read.
 *
 * Row taps hand the path up to `onOpenFile`, which the phone turns into a stack push and the
 * tablet into a viewer-column selection. The list stays ignorant of which.
 */
export function ChangesList({
  active,
  onOpenAll,
  onOpenFile,
}: {
  active: boolean
  /** Phone: push the read-all route. Omitted on tablet, which selects into its viewer column. */
  onOpenAll?: () => void
  /** Phone: push the file's route. Omitted on tablet, which selects into its viewer column. */
  onOpenFile?: (path: string) => void
}): React.JSX.Element {
  const bottomInset = useBottomChrome()
  const scope = useChangesStore((state) => state.scope)
  const setScope = useChangesStore((state) => state.setScope)
  const selection = useChangesStore((state) => state.selection)
  const selectFile = useChangesStore((state) => state.openFile)
  const selectAll = useChangesStore((state) => state.openAll)
  const openFile = onOpenFile ?? selectFile
  const openAll = onOpenAll ?? selectAll

  const { base, error, groups, isLoading } = useChangesFlow(active)
  const { stageFile, unstageFile } = useFileStaging()
  const { discardFile } = useDiscardFile()
  const [actionError, setActionError] = useState<string | null>(null)

  const summary = useMemo(() => summarizeChanges(groups ?? [], base), [base, groups])
  const sections = useMemo(
    () => (groups ?? []).map((group) => ({ data: group.files, layer: group.layer })),
    [groups],
  )

  // Every write here is a daemon round trip that can fail (a locked index, a vanished file);
  // report it on the header instead of letting a tap look like it worked.
  const guard = (label: string, run: () => Promise<void>): void => {
    setActionError(null)
    run().catch((cause: unknown) => {
      setActionError(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
    })
  }

  const actions: FileRowActions = {
    onDiscard: (path) => {
      guard('Discard failed', () => discardFile(path))
    },
    onOpen: openFile,
    onStage: (path) => {
      guard('Stage failed', () => stageFile(path))
    },
    onUnstage: (path) => {
      guard('Unstage failed', () => unstageFile(path))
    },
  }

  const selectedPath = selection?.kind === 'file' ? selection.path : null
  // Until the first read lands there is no honest count to print — "0 changed files" would
  // read as a clean tree.
  const pending = isLoading && groups === undefined
  const failure = actionError

  return (
    <View className="flex-1" testID="porcelain-changes-list">
      <ChangesHeader
        label={pending ? 'Loading changes…' : summary.label}
        scope={scope}
        total={summary.total}
        onReadAll={openAll}
        onScopeChange={setScope}
      />

      {failure === null ? null : (
        <View className="px-4 pb-2">
          <ErrorNote message={failure} testID="porcelain-changes-action-error" />
        </View>
      )}

      {error !== null ? (
        <View className="px-4 pb-2">
          <ErrorNote message={error.message} testID="porcelain-changes-error" />
        </View>
      ) : null}

      {pending ? (
        <Text
          className="px-4 py-6 text-sm text-muted-foreground"
          testID="porcelain-changes-loading"
        >
          Loading changes…
        </Text>
      ) : summary.total === 0 && error === null ? (
        <EmptyNote
          body={
            scope === 'branch'
              ? 'This branch has no commits beyond its base yet.'
              : 'Your working tree is clean.'
          }
          testID="porcelain-changes-empty"
          title="No changes to review"
        />
      ) : (
        <SectionList
          contentContainerStyle={surfaceContentStyle({ bottomInset, edgeToEdge: true, gap: 2 })}
          keyExtractor={(file: FlowFile) => file.path}
          renderItem={({ item }) => (
            <FileRow
              actions={actions}
              file={item}
              selected={item.path === selectedPath}
              working={scope === 'working'}
            />
          )}
          renderSectionHeader={({ section }) => (
            // The list is edge-to-edge so its rows can carry `SURFACE_ROW`; the section
            // label keeps the gutter itself rather than riding on the container's.
            <View className={cn('bg-background pb-1 pt-3', SURFACE_GUTTER)}>
              <PanelLabel>{section.layer}</PanelLabel>
            </View>
          )}
          sections={sections}
          stickySectionHeadersEnabled={false}
          testID="porcelain-changes-rows"
        />
      )}
    </View>
  )
}

function ChangesHeader({
  label,
  onReadAll,
  onScopeChange,
  scope,
  total,
}: {
  label: string
  onReadAll: () => void
  onScopeChange: (scope: ChangesScope) => void
  scope: ChangesScope
  total: number
}): React.JSX.Element {
  return (
    <View className={cn(SURFACE_TOOLBAR, SURFACE_STACK_GAP)}>
      <View className="flex-row items-center gap-1">
        <Text
          className="min-w-0 flex-1 text-xs text-muted-foreground"
          testID="porcelain-changes-summary"
        >
          {label}
        </Text>
        {/* An icon button is a 36pt box around a 17pt glyph, so sitting it *on* the gutter
            leaves the glyph 9pt inside it. The cluster hangs out to put the glyph on the
            gutter instead — the alignment the eye reads is the mark's, not the box's. */}
        <View className="-mr-2 flex-row items-center">
          <IconAction
            accessibilityLabel="Read all changes"
            disabled={total === 0}
            glyph="readAll"
            testID="porcelain-changes-read-all-open"
            onPress={onReadAll}
          />
        </View>
      </View>
      <SegmentedControl<ChangesScope>
        options={[
          { value: 'working', label: 'Working', testID: 'porcelain-changes-scope-working' },
          { value: 'branch', label: 'Branch', testID: 'porcelain-changes-scope-branch' },
        ]}
        testID="porcelain-changes-scope"
        value={scope}
        onChange={onScopeChange}
      />
    </View>
  )
}
