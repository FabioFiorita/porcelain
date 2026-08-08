import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { ChromeGlyph } from '@/components/chrome-glyph'
import { ShellModal, ShellModalScroll } from '@/components/shell-modal'
import { PANEL_CARD, SURFACE_GUTTER } from '@/components/surface-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { COMPANION } from './mock-data'
import {
  DataSettings,
  EnvironmentsSettings,
  GeneralSettings,
  ReviewSettings,
} from './settings-screen'
import { type SettingsSection, useShellStore } from './shell-store'
import { surfaceSlots } from './surface-slots'
import { WORKSPACE_CREATE_COPY } from './workspace-create-form'
import { BranchSheetBody, ProjectSheetBody, WorktreeSheetBody } from './workspace-switchers'

type ShellSheetsProps = {
  /**
   * Phone hides the settings sheet (Settings is a tab). Companion is phone-primary;
   * tablet still toggles the inspector column and can open the same sheet as fallback.
   */
  variant?: 'phone' | 'tablet'
}

function useSheetMetrics(): {
  sheetMaxW: number
  sheetMaxH: number
  settingsMaxW: number
  settingsMaxH: number
  searchMaxW: number
} {
  // Live dimensions — module-level Dimensions.get freezes portrait metrics on a
  // landscape iPad and starves the Settings dialog of width for segmented controls.
  const { width, height } = useWindowDimensions()
  const isPhoneWidth = width < 768
  return {
    sheetMaxW: isPhoneWidth ? Math.min(width - 24, 400) : Math.min(width * 0.55, 440),
    sheetMaxH: isPhoneWidth ? Math.min(height * 0.78, 640) : Math.min(height * 0.72, 520),
    settingsMaxW: Math.min(Math.max(width, height) * 0.55, 760),
    settingsMaxH: Math.min(Math.min(width, height) * 0.85, 680),
    searchMaxW: isPhoneWidth ? Math.min(width - 24, 400) : Math.min(width * 0.55, 500),
  }
}

export function ShellSheets({ variant = 'tablet' }: ShellSheetsProps): React.JSX.Element {
  const sheet = useShellStore((state) => state.sheet)
  const closeSheet = useShellStore((state) => state.closeSheet)
  const showSettingsSheet = variant === 'tablet'
  const { sheetMaxW, sheetMaxH, settingsMaxW, settingsMaxH, searchMaxW } = useSheetMetrics()
  // The create forms are a MODE of the picker sheet, not a second modal on top of it — a nested
  // native modal is not the key window on iOS and its keyboard avoidance stops working
  // (`shell-modal.tsx`). The flag lives here because the sheet's own header swaps with it.
  const [creating, setCreating] = useState<'branch' | 'worktree' | null>(null)

  useEffect(() => {
    if (sheet !== 'branch' && sheet !== 'worktree') setCreating(null)
  }, [sheet])

  const branchCreating = creating === 'branch'
  const worktreeCreating = creating === 'worktree'

  return (
    <>
      <ShellModal
        open={sheet === 'project'}
        onClose={closeSheet}
        title="Project"
        description="Open and recent projects."
        contentStyle={{ width: sheetMaxW, maxHeight: sheetMaxH }}
      >
        <ProjectSheetBody open={sheet === 'project'} />
      </ShellModal>

      <SearchCommandSheet open={sheet === 'search'} onClose={closeSheet} maxWidth={searchMaxW} />

      <ShellModal
        open={sheet === 'branch'}
        onClose={closeSheet}
        title={branchCreating ? WORKSPACE_CREATE_COPY.branch.title : 'Branch'}
        description={
          branchCreating
            ? WORKSPACE_CREATE_COPY.branch.description
            : 'Switch branch in this worktree.'
        }
        contentStyle={{ width: sheetMaxW, maxHeight: sheetMaxH }}
      >
        <BranchSheetBody
          creating={branchCreating}
          open={sheet === 'branch'}
          onCreatingChange={(next) => {
            setCreating(next ? 'branch' : null)
          }}
        />
      </ShellModal>

      <ShellModal
        open={sheet === 'worktree'}
        onClose={closeSheet}
        title={worktreeCreating ? WORKSPACE_CREATE_COPY.worktree.title : 'Worktree'}
        description={
          worktreeCreating
            ? WORKSPACE_CREATE_COPY.worktree.description
            : 'Open or switch a worktree.'
        }
        contentStyle={{ width: sheetMaxW, maxHeight: sheetMaxH }}
      >
        <WorktreeSheetBody
          creating={worktreeCreating}
          open={sheet === 'worktree'}
          onCreatingChange={(next) => {
            setCreating(next ? 'worktree' : null)
          }}
        />
      </ShellModal>

      {showSettingsSheet ? (
        <ShellModal
          open={sheet === 'settings'}
          onClose={closeSheet}
          title="Settings"
          description="General, Review, and Environments for this client."
          contentStyle={{ width: settingsMaxW, maxHeight: settingsMaxH }}
        >
          <SettingsSheetBody settingsMaxH={settingsMaxH} />
        </ShellModal>
      ) : null}

      <ShellModal
        open={sheet === 'companion'}
        onClose={closeSheet}
        title={undefined}
        hideHeader
        bare
        contentStyle={{ width: sheetMaxW, maxHeight: sheetMaxH }}
      >
        <CompanionSheetBody />
      </ShellModal>
    </>
  )
}

function CompanionSheetBody(): React.JSX.Element {
  const surfaceId = useShellStore((state) => state.activeSurface)
  const sections = COMPANION[surfaceId]
  const closeSheet = useShellStore((state) => state.closeSheet)
  const { sheetMaxH } = useSheetMetrics()
  const slots = surfaceSlots(surfaceId)

  return (
    <View className="gap-3 py-5" testID="porcelain-companion-sheet">
      {/* Horizontal padding lives here, not on the outer View: a real surface's companion
          (below) already carries its own `SURFACE_GUTTER`, the same one every other screen
          uses — wrapping it in a second, wider gutter doubled the inset from the sheet edge
          to the actual content, which is what read as "too much padding" next to Files. */}
      <View className={cn('gap-1 pr-8', SURFACE_GUTTER)}>
        <Text className="text-lg font-semibold text-foreground">Companion</Text>
      </View>
      {/* A real surface renders its own scrolling companion; the mock sections stay for the
          tabs that have not landed yet. */}
      {slots !== undefined ? (
        <View style={{ height: sheetMaxH - 170 }}>
          <slots.companion active />
        </View>
      ) : (
        <ShellModalScroll
          contentContainerClassName={SURFACE_GUTTER}
          style={{ maxHeight: sheetMaxH - 120 }}
        >
          {sections.map((section) => (
            <View key={section.id} className={cn('gap-2 p-3', PANEL_CARD)}>
              <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {section.title}
              </Text>
              <View className="gap-2">
                {section.rows.map((row) => (
                  <View key={row.id} className="gap-0.5">
                    <Text className="text-sm font-medium text-foreground">{row.label}</Text>
                    {row.detail ? (
                      <Text className="text-xs text-muted-foreground">{row.detail}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ShellModalScroll>
      )}
      <View className={SURFACE_GUTTER}>
        <Button onPress={closeSheet} variant="outline">
          <UiText>Done</UiText>
        </Button>
      </View>
    </View>
  )
}

/** Command-palette search — RN Modal + input + grouped list (web Command shape). */
function SearchCommandSheet({
  open,
  onClose,
  maxWidth,
}: {
  open: boolean
  onClose: () => void
  maxWidth: number
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const { sheetMaxH } = useSheetMetrics()
  const q = query.trim().toLowerCase()

  const files = useMemo(
    () =>
      [
        { id: 'f1', label: 'apps/mobile/src/app/_layout.tsx', detail: 'File' },
        { id: 'f2', label: 'apps/mobile/src/features/shell/tablet-shell.tsx', detail: 'File' },
        { id: 'f3', label: 'apps/web/src/components/shell/title-bar.tsx', detail: 'File' },
        { id: 'f4', label: 'packages/contracts/src/index.ts', detail: 'File' },
        { id: 'f5', label: '.agents/skills/mobile/SKILL.md', detail: 'File' },
        { id: 'f6', label: 'apps/mobile/src/features/shell/shell-sheets.tsx', detail: 'File' },
      ].filter((row) => q === '' || row.label.toLowerCase().includes(q)),
    [q],
  )

  const commands = useMemo(
    () =>
      [
        { id: 'c1', label: 'pnpm verify', detail: 'Saved action' },
        { id: 'c2', label: 'pnpm --dir apps/mobile typecheck', detail: 'Saved action' },
        { id: 'c3', label: 'eas fingerprint:compare', detail: 'Saved action' },
      ].filter(
        (row) =>
          q === '' || row.label.toLowerCase().includes(q) || row.detail.toLowerCase().includes(q),
      ),
    [q],
  )

  const commits = useMemo(
    () =>
      [
        { id: 'h1', label: 'a3f2c01', detail: 'Shell: tablet SplitView POC' },
        { id: 'h2', label: '91be440', detail: 'Mobile: NativeWind reusables pass' },
        { id: 'h3', label: '0e12ab9', detail: 'Daemon: environments store' },
      ].filter(
        (row) =>
          q === '' || row.label.toLowerCase().includes(q) || row.detail.toLowerCase().includes(q),
      ),
    [q],
  )

  const empty = files.length === 0 && commands.length === 0 && commits.length === 0

  return (
    <ShellModal
      bare
      hideHeader
      open={open}
      onClose={() => {
        setQuery('')
        onClose()
      }}
      contentStyle={{ width: maxWidth, maxHeight: sheetMaxH }}
    >
      <View className="flex-row items-center gap-2 border-b border-border px-3 py-1 pr-12">
        <ChromeGlyph name="search" size={16} />
        <Input
          autoFocus={open}
          className="native:h-12 flex-1 border-0 bg-transparent px-0 text-base shadow-none dark:bg-transparent"
          onChangeText={setQuery}
          placeholder="Search files, folders, commands, commits…"
          returnKeyType="search"
          value={query}
        />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={{ maxHeight: sheetMaxH - 72 }}
        contentContainerClassName="py-1.5 pb-3"
      >
        {empty ? (
          <Text className="px-4 py-8 text-center text-sm text-muted-foreground">
            No results{q ? ` for “${query.trim()}”` : ''}.
          </Text>
        ) : null}

        {files.length > 0 ? (
          <CommandGroup heading="Files">
            {files.map((row) => (
              <CommandItem
                key={row.id}
                label={row.label}
                detail={row.detail}
                onPress={() => {
                  setQuery('')
                  onClose()
                }}
              />
            ))}
          </CommandGroup>
        ) : null}

        {commands.length > 0 ? (
          <CommandGroup heading="Commands">
            {commands.map((row) => (
              <CommandItem
                key={row.id}
                label={row.label}
                detail={row.detail}
                onPress={() => {
                  setQuery('')
                  onClose()
                }}
              />
            ))}
          </CommandGroup>
        ) : null}

        {commits.length > 0 ? (
          <CommandGroup heading="Commits">
            {commits.map((row) => (
              <CommandItem
                key={row.id}
                label={row.label}
                detail={row.detail}
                onPress={() => {
                  setQuery('')
                  onClose()
                }}
              />
            ))}
          </CommandGroup>
        ) : null}
      </ScrollView>
    </ShellModal>
  )
}

function CommandGroup({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <View className="gap-0.5 px-1 py-1">
      <Text className="px-3 py-1.5 text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
        {heading}
      </Text>
      {children}
    </View>
  )
}

function CommandItem({
  label,
  detail,
  onPress,
}: {
  label: string
  detail: string
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      className="mx-1 flex-row items-center gap-3 rounded-lg px-3 py-2.5 active:bg-accent"
      onPress={onPress}
    >
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

function SettingsSheetBody({ settingsMaxH }: { settingsMaxH: number }): React.JSX.Element {
  const section = useShellStore((state) => state.settingsSection)
  const setSettingsSection = useShellStore((state) => state.setSettingsSection)

  const sections: { id: SettingsSection; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'data', label: 'Data' },
    { id: 'review', label: 'Review' },
    { id: 'environments', label: 'Environments' },
  ]

  // Explicit height (not maxHeight alone): a flex:1 ScrollView inside maxHeight-only
  // collapses to zero and the dialog looks empty. Same panels as the phone Settings tab.
  const bodyHeight = Math.max(settingsMaxH - 120, 360)

  return (
    <View
      className="flex-row gap-4"
      style={{ height: bodyHeight }}
      testID="porcelain-tablet-settings"
    >
      <View className="w-36 shrink-0 gap-1" testID="porcelain-tablet-settings-nav">
        {sections.map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityRole="button"
            accessibilityState={{ selected: section === entry.id }}
            className={cn(
              'rounded-lg border border-transparent px-3 py-2.5 active:bg-accent',
              section === entry.id && 'border-border bg-accent',
            )}
            testID={`porcelain-tablet-settings-section-${entry.id}`}
            onPress={() => {
              setSettingsSection(entry.id)
            }}
          >
            <Text
              className={cn(
                'text-sm font-medium',
                section === entry.id ? 'text-accent-foreground' : 'text-foreground',
              )}
            >
              {entry.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="w-px self-stretch bg-border" />

      <ShellModalScroll className="min-w-0 w-full flex-1" testID="porcelain-tablet-settings-body">
        <View className="w-full gap-3 pr-1">
          {section === 'general' ? <GeneralSettings /> : null}
          {section === 'data' ? <DataSettings /> : null}
          {section === 'review' ? <ReviewSettings /> : null}
          {section === 'environments' ? <EnvironmentsSettings /> : null}
        </View>
      </ShellModalScroll>
    </View>
  )
}
