import type { HubProject, HubWorktree } from '@porcelain/contracts/projects'
import { gitProcedures } from '@porcelain/contracts/git'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { RowContextMenu, type RowMenuAction } from '@/components/ui/row-context-menu'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SURFACE_ROW, SURFACE_ROW_SELECTED } from '@/components/surface-layout'
import { Text } from '@/components/ui/text'
import type { Environment } from '@/features/remote'
import { copyText } from '@/lib/clipboard'
import { namedContractProcedure } from '@/lib/daemon/procedure'
import { callGit } from '@/features/git/use-git-transport'
import { cn } from '@/lib/utils'

import { useRetireHubWorktree } from './hub-mutations'
import { openHubWorktree } from './hub-selection'

const checkoutProcedure = namedContractProcedure('gitCheckout', gitProcedures.gitCheckout)

/**
 * One Worktree in the Hub list.
 *
 * Only fields `hubWorktreeSchema` actually carries are printed — name, branch, primary — plus
 * the Environment nickname this device paired it under. There is no status on the record, so
 * there is no status badge.
 *
 * `open` is how the tap moves. The full-width list PUSHES, because choosing a Worktree there
 * is a step deeper into the same stack. The tablet sidebar stays on screen beside what it
 * opened, so a second tap there is a SWITCH, not a step — pushing would grow the back stack by
 * one screen per Worktree you glanced at, and the chevron would walk you back through every one.
 *
 * Retiring is the platform's two gestures for the same thing: a swipe from the trailing edge,
 * and the same item in the long-press context menu, both ending at a destructive `Alert`.
 * `git worktree remove` takes the checkout off the disk, so the confirmation is not a
 * formality — and the PRIMARY checkout is the Project itself, which git refuses to remove, so
 * that row offers neither gesture rather than producing an error the human cannot act on.
 */
export function WorktreeRow({
  environment,
  open = 'push',
  project,
  selected,
  worktree,
}: {
  environment: Environment | null
  /** `push` from the full-width list, `navigate` from the persistent tablet sidebar. */
  open?: 'push' | 'navigate'
  project: HubProject
  selected: boolean
  worktree: HubWorktree
}): React.JSX.Element {
  const router = useRouter()
  const actions = useRetireHubWorktree()
  const queryClient = useQueryClient()
  const swipe = useRef<SwipeableMethods | null>(null)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [branch, setBranch] = useState(worktree.branch)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const checkout = useMutation({
    mutationFn: async (next: string) =>
      callGit(environment, checkoutProcedure, { branch: next, repoPath: worktree.path }),
    onSuccess: async () => {
      if (environment !== null)
        await queryClient.invalidateQueries({ queryKey: ['daemon', environment.id] })
      setSwitchOpen(false)
    },
  })
  const retirable = environment !== null && !worktree.isPrimary

  const retire = (): void => {
    if (environment === null) return
    void actions.retire(environment, worktree).catch((reason: unknown) => {
      Alert.alert(
        'Could not retire that Worktree',
        reason instanceof Error && reason.message.length > 0
          ? reason.message
          : 'The daemon refused the request.',
      )
    })
  }

  const confirmRetire = (): void => {
    swipe.current?.close()
    Alert.alert(
      `Retire ${worktree.name}?`,
      `Its checkout at ${worktree.path} is removed from disk. The branch ${worktree.branch} is kept.`,
      [
        { style: 'cancel', text: 'Cancel' },
        { onPress: retire, style: 'destructive', text: 'Retire' },
      ],
    )
  }

  const menuActions: RowMenuAction[] = [
    {
      disabled: environment === null,
      glyph: 'branch',
      id: 'switch-branch',
      label: 'Switch branch',
      onPress: () => {
        setBranch(worktree.branch)
        setSwitchError(null)
        setSwitchOpen(true)
      },
    },
    {
      glyph: 'copy',
      id: 'copy-name',
      label: 'Copy name',
      onPress: () => {
        void copyText(worktree.name)
      },
    },
    {
      glyph: 'copy',
      id: 'copy-path',
      label: 'Copy path',
      onPress: () => {
        void copyText(worktree.path)
      },
    },
    ...(retirable
      ? ([
          {
            destructive: true,
            glyph: 'trash',
            id: 'remove',
            label: 'Remove worktree',
            onPress: confirmRetire,
          },
        ] satisfies RowMenuAction[])
      : []),
  ]

  const row = (
    <Pressable
      accessibilityLabel={`Worktree ${worktree.name}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(SURFACE_ROW, selected && SURFACE_ROW_SELECTED)}
      testID={`porcelain-hub-worktree-${worktree.id}`}
      onPress={() => {
        if (environment === null) return
        void openHubWorktree(environment, worktree).then(() => {
          if (open === 'navigate') router.navigate('/worktree')
          else router.push('/worktree')
        })
      }}
    >
      <View className="flex-row items-center gap-2">
        <ChromeGlyph name="branch" size={14} tone="muted" />
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
            {worktree.name}
          </Text>
          <Text className="font-mono text-3xs text-muted-foreground" numberOfLines={1}>
            {worktree.branch}
          </Text>
        </View>
        <Text className="shrink-0 text-3xs text-muted-foreground" numberOfLines={1}>
          {environment?.nickname ?? project.environmentId}
        </Text>
        <ChromeGlyph name="chevronRight" size={11} tone="muted" />
      </View>
    </Pressable>
  )

  // The menu host wraps the row and the swipeable wraps the menu host, so the whole row —
  // long-press affordance included — travels with the gesture.
  return (
    <>
      <ReanimatedSwipeable
        ref={swipe}
        enabled={retirable && !actions.isPending}
        friction={2}
        renderRightActions={
          retirable
            ? () => (
                <Pressable
                  accessibilityLabel={`Retire ${worktree.name}`}
                  accessibilityRole="button"
                  className="w-24 items-center justify-center bg-destructive active:opacity-80"
                  testID={`porcelain-hub-worktree-retire-${worktree.id}`}
                  onPress={confirmRetire}
                >
                  {/* A word, not a glyph: `ChromeGlyph` tints from the semantic palette, and
                    none of its tones is guaranteed to read on the destructive fill in both
                    schemes. */}
                  <Text className="text-sm font-semibold text-white">Retire</Text>
                </Pressable>
              )
            : undefined
        }
        rightThreshold={40}
      >
        <RowContextMenu
          actions={menuActions}
          testID={`porcelain-hub-worktree-menu-${worktree.id}`}
          title={worktree.name}
        >
          {row}
        </RowContextMenu>
      </ReanimatedSwipeable>
      <Sheet
        open={switchOpen}
        testID="porcelain-switch-branch"
        title="Switch branch"
        onClose={() => setSwitchOpen(false)}
      >
        <View className="gap-3 px-5">
          <Input
            autoCapitalize="none"
            autoCorrect={false}
            className="font-mono"
            placeholder="Branch"
            value={branch}
            onChangeText={setBranch}
          />
          {switchError === null ? null : (
            <Text className="text-xs text-destructive">{switchError}</Text>
          )}
          <View className="flex-row justify-end gap-2">
            <Button variant="ghost" onPress={() => setSwitchOpen(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button
              disabled={checkout.isPending}
              onPress={() => {
                const next = branch.trim()
                if (next === '') {
                  setSwitchError('Enter a branch name.')
                  return
                }
                void checkout
                  .mutateAsync(next)
                  .catch((reason: unknown) =>
                    setSwitchError(
                      reason instanceof Error ? reason.message : 'Could not switch branches.',
                    ),
                  )
              }}
            >
              <Text>Switch</Text>
            </Button>
          </View>
        </View>
      </Sheet>
    </>
  )
}
