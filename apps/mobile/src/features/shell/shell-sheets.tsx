import { useEffect, useState } from 'react'
import { Pressable, Text, useWindowDimensions, View } from 'react-native'
import { ShellModal, ShellModalScroll } from '@/components/shell-modal'
import { SURFACE_GUTTER } from '@/components/surface-layout'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { QuickOpenSheet } from '@/features/quick-open/quick-open-sheet'
import {
  DataSettings,
  EnvironmentsSettings,
  GeneralSettings,
} from '@/features/settings/settings-screen'
import { cn } from '@/lib/utils'
import { BranchSheetBody } from './branch-sheet'
import { ProjectSheetBody } from './project-sheet'
import { type SettingsSection, useShellStore } from './shell-store'
import { surfaceSlots } from './surface-slots'
import { WORKSPACE_CREATE_COPY } from './workspace-create-form'
import { WorktreeSheetBody } from './worktree-sheet'

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

      <QuickOpenSheet open={sheet === 'search'} onClose={closeSheet} maxWidth={searchMaxW} />

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
          description="General and Environments for this client."
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
  const closeSheet = useShellStore((state) => state.closeSheet)
  const { sheetMaxH } = useSheetMetrics()
  const slots = surfaceSlots(surfaceId)

  return (
    <View className="gap-3 py-5" testID="porcelain-companion-sheet">
      {/* Horizontal padding lives here, not on the outer View: the companion below already
          carries its own `SURFACE_GUTTER`, the same one every other screen uses — wrapping it
          in a second, wider gutter doubled the inset from the sheet edge to the actual
          content, which is what read as "too much padding" next to Files. */}
      <View className={cn('gap-1 pr-8', SURFACE_GUTTER)}>
        <Text className="text-lg font-semibold text-foreground">Companion</Text>
      </View>
      {/* nativewind-allow-style: the height is derived from live window metrics, not a class. */}
      <View style={{ height: sheetMaxH - 170 }}>
        <slots.companion active />
      </View>
      <View className={SURFACE_GUTTER}>
        <Button onPress={closeSheet} variant="outline">
          <UiText>Done</UiText>
        </Button>
      </View>
    </View>
  )
}

function SettingsSheetBody({ settingsMaxH }: { settingsMaxH: number }): React.JSX.Element {
  const section = useShellStore((state) => state.settingsSection)
  const setSettingsSection = useShellStore((state) => state.setSettingsSection)

  const sections: { id: SettingsSection; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'data', label: 'Data' },
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
          {section === 'environments' ? <EnvironmentsSettings /> : null}
        </View>
      </ShellModalScroll>
    </View>
  )
}
