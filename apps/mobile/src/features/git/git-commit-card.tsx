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
/*
 * The composer reads the Changes feature's draft store, staging facts and token chip rather
 * than growing its own. A commit draft belongs to a repository, not to a screen — web keeps
 * exactly one per repo path — so a second store here would let the same message exist twice
 * with different text. The other two are the same rule for logic and for a control that
 * already speaks conventional commits.
 */
import { useCommitDraftStore } from '@/features/changes/commit-draft-store'
import { commitReady, stagingState } from '@/features/changes/commit-staging'
import { CommitTokenChip } from '@/features/changes/commit-token-chip'
import { useHubRepoPath } from '@/features/projects'
import { cn } from '@/lib/utils'

import { generatedGroupsStatus, groupApplyOutcome } from './commit-groups'
import { useApplyCommitGroups, useCommit, useCommitGeneration, useStageAll } from './git-mutations'
import { useCommitConventions, useWorkingFlow } from './git-queries'

/**
 * The commit composer: conventional-commit tokens over a free-text message, the staging
 * toggle, both generators, and the grouped proposal.
 *
 * The textarea stays the single source of truth — the tokens only read and rewrite its leading
 * prefix, so a hand-written message with no prefix commits exactly as typed.
 *
 * There is no Push here. Push is a quick command, and web removed the second copy under Commit
 * for the same reason: one place to run a command, one place to read what it said.
 */
export function GitCommitCard({ active }: { active: boolean }): React.JSX.Element {
  const repoPath = useHubRepoPath() ?? ''
  const message = useCommitDraftStore((state) => state.messages[repoPath] ?? '')
  const setMessage = useCommitDraftStore((state) => state.setMessage)
  const clearMessage = useCommitDraftStore((state) => state.clearMessage)

  const conventions = useCommitConventions()
  const { commit, error: commitError, isCommitting } = useCommit()
  const { generateGroups, generateMessage, isGenerating } = useCommitGeneration()
  const { isStaging, stageAll, unstageAll } = useStageAll()
  const { applyGroups, isApplying } = useApplyCommitGroups()
  // Staging and committing always act on the working tree, whatever range a list is reading.
  const groups = useWorkingFlow(active)

  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null)
  const [proposed, setProposed] = useState<readonly CommitGroupGenerationGroup[] | null>(null)

  const { allStaged, hasStaged, hasUnstaged, treeClean } = stagingState(groups)
  const { scope, type } = parseCommitPrefix(message)
  const ready = commitReady(message, treeClean)

  /**
   * Every action in this card reports on the one status line — a generated message, a staging
   * write, a failed provider. Nothing here fails silently.
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
    report(async () => {
      await commit(message.trim())
      clearMessage(repoPath)
      setProposed(null)
      return 'Committed'
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
      setProposed(null)
      return 'Generated commit message'
    })
  }

  const handleGenerateGroups = (): void => {
    if (hasStaged || !hasUnstaged || isGenerating) return
    report(async () => {
      const next = await generateGroups()
      setProposed(next)
      return generatedGroupsStatus(next.length)
    })
  }

  /**
   * Accept the whole proposal. The daemon stages and commits every group in one call, so the
   * human never stages or commits a group by hand — that is the point of the feature.
   */
  const handleAcceptGroups = (): void => {
    if (proposed === null || isApplying) return
    setStatus(null)
    runUserAction(
      async () => {
        const outcome = groupApplyOutcome(await applyGroups(proposed))
        setProposed(outcome.remaining.length === 0 ? null : outcome.remaining)
        if (!outcome.status.failed) clearMessage(repoPath)
        setStatus(outcome.status)
      },
      (cause) => {
        setStatus({ failed: true, text: cause instanceof Error ? cause.message : String(cause) })
      },
    )
  }

  return (
    <View className="gap-2" testID="porcelain-git-commit">
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
          testID="porcelain-git-commit-message"
          value={message}
          onChangeText={(next) => {
            setMessage(repoPath, next)
          }}
        />

        {status === null ? null : (
          <StatusNote
            failed={status.failed}
            testID="porcelain-git-commit-status"
            text={status.text}
          />
        )}
        {commitError === null ? null : (
          <StatusNote failed testID="porcelain-git-commit-error" text={commitError.message} />
        )}

        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            disabled={isStaging || treeClean}
            size="sm"
            testID="porcelain-git-stage-all"
            variant="outline"
            onPress={handleToggleStaging}
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
            testID="porcelain-git-commit-button"
            onPress={handleCommit}
          >
            <ChromeGlyph name="commit" size={14} tone="primaryForeground" />
            <UiText>{isCommitting ? 'Committing…' : 'Commit'}</UiText>
          </Button>
        </View>

        <View className="gap-2">
          <Button
            disabled={!hasStaged || isGenerating}
            size="sm"
            testID="porcelain-git-generate-message"
            variant="outline"
            onPress={handleGenerateMessage}
          >
            <ChromeGlyph name="sparkles" size={14} tone="foreground" />
            <UiText>{isGenerating ? 'Generating…' : 'Generate Commit Message'}</UiText>
          </Button>
          <Button
            disabled={hasStaged || !hasUnstaged || isGenerating}
            size="sm"
            testID="porcelain-git-generate-groups"
            variant="outline"
            onPress={handleGenerateGroups}
          >
            <ChromeGlyph name="layers" size={14} tone="foreground" />
            <UiText>{isGenerating ? 'Generating…' : 'Generate Group Commit'}</UiText>
          </Button>
        </View>

        {proposed === null || proposed.length === 0 ? null : (
          <ProposedCommits applying={isApplying} groups={proposed} onAccept={handleAcceptGroups} />
        )}
      </View>
    </View>
  )
}

/**
 * The proposal, and the one tap that takes it. A group is never staged from here on its own:
 * the daemon commits the batch, and whatever it could not commit stays listed above with the
 * reason on the status line.
 */
function ProposedCommits({
  applying,
  groups,
  onAccept,
}: {
  applying: boolean
  groups: readonly CommitGroupGenerationGroup[]
  onAccept: () => void
}): React.JSX.Element {
  return (
    <View className="gap-2 border-t border-border pt-2" testID="porcelain-git-groups">
      <PanelLabel>Proposed commits</PanelLabel>
      {groups.map((group, index) => (
        <View key={group.files.join('|')} className={cn('gap-1 p-2.5', PANEL_CARD)}>
          <Text className="text-3xs text-muted-foreground">Commit {index + 1}</Text>
          <Text className="text-xs font-medium text-foreground">{group.message}</Text>
          <Text className="font-mono text-3xs leading-4 text-muted-foreground">
            {group.files.join(', ')}
          </Text>
        </View>
      ))}
      <Button disabled={applying} size="sm" testID="porcelain-git-accept-groups" onPress={onAccept}>
        <ChromeGlyph name="check" size={14} tone="primaryForeground" />
        <UiText>
          {applying
            ? 'Committing…'
            : `Accept all — commit ${groups.length} ${groups.length === 1 ? 'group' : 'groups'}`}
        </UiText>
      </Button>
    </View>
  )
}
