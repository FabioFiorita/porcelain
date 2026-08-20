import { applyCommitPrefix, parseCommitPrefix } from '@porcelain/client-runtime/commit-message'
import type { CommitGroupGenerationGroup } from '@porcelain/contracts'
import { runUserAction } from '@porcelain/shared/background'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { ChromeGlyph } from '@/components/chrome-glyph'
import { PanelLabel, StatusNote } from '@/components/panel-chrome'
import { PANEL_CARD } from '@/components/surface-layout'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import {
  useCommit,
  useCommitConventions,
  useCommitGeneration,
  useFileStaging,
  usePush,
  useStageAll,
  useWorkingFlow,
} from '@/features/git'
import { useHubRepoPath } from '@/features/projects'
import { cn } from '@/lib/utils'
import { useCommitDraftStore } from './commit-draft-store'
import { commitReady, stagingState } from './commit-staging'
import { CommitTokenChip } from './commit-token-chip'

/**
 * The commit composer: conventional-commit tokens over a free-text message, the staging
 * toggle, and both generators.
 *
 * The textarea stays the single source of truth — the tokens only read and rewrite its
 * leading prefix, so a hand-written message with no prefix commits exactly as typed.
 */
export function CommitCard({ active }: { active: boolean }): React.JSX.Element {
  const repoPath = useHubRepoPath() ?? ''
  const message = useCommitDraftStore((state) => state.messages[repoPath] ?? '')
  const setMessage = useCommitDraftStore((state) => state.setMessage)
  const clearMessage = useCommitDraftStore((state) => state.clearMessage)

  const conventions = useCommitConventions()
  const { commit, error: commitError, isCommitting } = useCommit()
  const { generateGroups, generateMessage, isGenerating } = useCommitGeneration()
  const { isStaging, stageAll, unstageAll } = useStageAll()
  const { stageFile } = useFileStaging()
  const { isPushing, push } = usePush()
  // Commit always acts on the working tree, whatever scope the list is reading.
  const groups = useWorkingFlow(active)

  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null)
  const [generated, setGenerated] = useState<CommitGroupGenerationGroup[] | null>(null)
  const [applyingGroup, setApplyingGroup] = useState(false)

  const { allStaged, hasStaged, hasUnstaged, treeClean } = stagingState(groups)
  const { scope, type } = parseCommitPrefix(message)
  const ready = commitReady(message, treeClean)

  /**
   * Every action in this card reports on the one status line — a generated message, a staging
   * write, a failed provider. Nothing here fails silently. Returns void for sync UI edges.
   */
  const report = (run: () => Promise<string>): void => {
    setStatus(null)
    runUserAction(
      async () => {
        setStatus({ failed: false, text: await run() })
      },
      (cause) => {
        setStatus({ failed: true, text: cause instanceof Error ? cause.message : String(cause) })
      },
    )
  }

  const handleCommit = (): void => {
    if (!ready || isCommitting) return
    setStatus(null)
    runUserAction(
      async () => {
        await commit(message.trim())
        clearMessage(repoPath)
        setGenerated(null)
        setStatus({ failed: false, text: 'Committed' })
      },
      (cause) => {
        setStatus({ failed: true, text: cause instanceof Error ? cause.message : String(cause) })
      },
    )
  }

  /**
   * A clean tree is the normal state for a push — the commits are already made — so this is the
   * one action here that survives `treeClean`. The daemon's output is printed as written: an
   * "Everything up-to-date" and a rejected non-fast-forward must not look alike.
   */
  const handlePush = (): void => {
    if (isPushing) return
    report(async () => {
      const output = await push()
      return output === '' ? 'Pushed' : output
    })
  }

  const handleToggleStaging = (): void => {
    if (isStaging) return
    report(async () => {
      if (allStaged) {
        await unstageAll()
        return 'Unstaged all changes'
      }
      await stageAll()
      return 'Staged all changes'
    })
  }

  const handleGenerateMessage = (): void => {
    if (!hasStaged || isGenerating) return
    report(async () => {
      const next = await generateMessage()
      setMessage(repoPath, next)
      setGenerated(null)
      return 'Generated commit message'
    })
  }

  const handleGenerateGroups = (): void => {
    if (hasStaged || !hasUnstaged || isGenerating) return
    report(async () => {
      const next = await generateGroups()
      setGenerated(next)
      return `Generated ${next.length} commit group${next.length === 1 ? '' : 's'}`
    })
  }

  const handleUseGroup = (group: CommitGroupGenerationGroup): void => {
    if (applyingGroup) return
    setApplyingGroup(true)
    setStatus(null)
    runUserAction(
      async () => {
        for (const path of group.files) await stageFile(path)
        setMessage(repoPath, group.message)
        setStatus({
          failed: false,
          text: `Staged ${group.files.length} file${group.files.length === 1 ? '' : 's'} for this group`,
        })
      },
      (cause) => {
        setStatus({ failed: true, text: cause instanceof Error ? cause.message : String(cause) })
      },
      () => {
        setApplyingGroup(false)
      },
    )
  }

  return (
    <View className="gap-2" testID="porcelain-changes-commit">
      <PanelLabel>Commit</PanelLabel>
      {treeClean ? (
        <Text className="text-2xs text-muted-foreground">
          Working tree clean — nothing to stage or commit.
        </Text>
      ) : null}

      <View className={cn('gap-2.5 p-3', PANEL_CARD)}>
        <View className="flex-row gap-1.5">
          <CommitTokenChip
            disabled={treeClean || conventions === undefined}
            kind="type"
            options={conventions?.types ?? []}
            value={type}
            onChange={(next) => {
              setMessage(repoPath, applyCommitPrefix(message, next, next === null ? null : scope))
            }}
          />
          <CommitTokenChip
            disabled={treeClean || type === null || conventions === undefined}
            kind="scope"
            options={conventions?.scopes ?? []}
            value={scope}
            onChange={(next) => {
              setMessage(repoPath, applyCommitPrefix(message, type, next))
            }}
          />
        </View>

        <Textarea
          accessibilityLabel="Commit message"
          className="min-h-20"
          editable={!treeClean}
          placeholder={treeClean ? 'Nothing to commit' : 'Commit message'}
          testID="porcelain-changes-commit-message"
          value={message}
          onChangeText={(next) => {
            setMessage(repoPath, next)
          }}
        />

        {status === null ? null : (
          <StatusNote
            failed={status.failed}
            testID="porcelain-changes-commit-status"
            text={status.text}
          />
        )}
        {commitError === null ? null : (
          <StatusNote failed text={commitError.message} testID="porcelain-changes-commit-error" />
        )}

        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            disabled={isStaging || treeClean}
            size="sm"
            testID="porcelain-changes-stage-all"
            variant="outline"
            onPress={() => {
              handleToggleStaging()
            }}
          >
            <ChromeGlyph name={allStaged ? 'minus' : 'plus'} size={14} tone="foreground" />
            <UiText>
              {isStaging
                ? allStaged
                  ? 'Unstaging…'
                  : 'Staging…'
                : allStaged
                  ? 'Unstage all'
                  : 'Stage all'}
            </UiText>
          </Button>
          <Button
            className="flex-1"
            disabled={!ready || isCommitting}
            size="sm"
            testID="porcelain-changes-commit-button"
            onPress={() => {
              handleCommit()
            }}
          >
            <ChromeGlyph name="commit" size={14} tone="primaryForeground" />
            <UiText>{isCommitting ? 'Committing…' : 'Commit'}</UiText>
          </Button>
        </View>

        <Button
          accessibilityLabel="Push"
          disabled={isPushing}
          size="sm"
          testID="porcelain-changes-push"
          variant="outline"
          onPress={() => {
            handlePush()
          }}
        >
          <ChromeGlyph name="arrowUpFromLine" size={14} tone="foreground" />
          <UiText>{isPushing ? 'Pushing…' : 'Push'}</UiText>
        </Button>

        <View className="gap-2">
          <Button
            disabled={!hasStaged || isGenerating}
            size="sm"
            testID="porcelain-changes-generate-message"
            variant="outline"
            onPress={() => {
              handleGenerateMessage()
            }}
          >
            <ChromeGlyph name="sparkles" size={14} tone="foreground" />
            <UiText>{isGenerating ? 'Generating…' : 'Generate Commit Message'}</UiText>
          </Button>
          <Button
            disabled={hasStaged || !hasUnstaged || isGenerating}
            size="sm"
            testID="porcelain-changes-generate-groups"
            variant="outline"
            onPress={() => {
              handleGenerateGroups()
            }}
          >
            <ChromeGlyph name="layers" size={14} tone="foreground" />
            <UiText>{isGenerating ? 'Generating…' : 'Generate Group Commit'}</UiText>
          </Button>
          <Text className="text-2xs leading-4 text-muted-foreground">
            {hasStaged
              ? 'Message is written from the staged diff.'
              : 'Groups split the unstaged diff into separate commits — stage one to write its message.'}
          </Text>
        </View>

        {generated === null ? null : (
          <View className="gap-2 border-t border-border pt-2" testID="porcelain-changes-groups">
            <PanelLabel>Generated groups</PanelLabel>
            {generated.map((group) => (
              <View key={group.files.join('|')} className={cn('gap-1 p-2.5', PANEL_CARD)}>
                <Text className="text-xs font-medium text-foreground">{group.message}</Text>
                <Text className="font-mono text-3xs leading-4 text-muted-foreground">
                  {group.files.join(', ')}
                </Text>
                <Button
                  className="self-start"
                  disabled={applyingGroup}
                  size="sm"
                  testID={`porcelain-changes-stage-group-${group.files.length}`}
                  variant="ghost"
                  onPress={() => {
                    handleUseGroup(group)
                  }}
                >
                  <UiText>Stage group</UiText>
                </Button>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}
