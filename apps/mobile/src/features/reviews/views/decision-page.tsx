import { ReviewRequest } from './review-request';
import { ProofAsset } from './review-briefing';
import { useState } from 'react';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import {
  readCommentThreads,
  readReviewComments,
  readReviewRevisionDiffs,
} from '@porcelain/client/reviews';
import {
  anchorPath,
  decisionKey,
  decisionLinks,
  decisionQuestions,
  decisionRoute,
  filesReviewed,
  questionAnswer,
  teachRequest,
  optionRequest,
  guardRequest,
  type CommentThread,
  type ReviewResponse,
  type ReviewRevision,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Item } from '../../../components/ui/item';
import { Icon } from '../../../components/ui/icon';
import { DiffView } from '../../../components/ui/diff-view';
import { DECISION_DIFF_FILES } from '../../../config/limits';
import { sourceLanguage } from '../../../shared/rules/highlight-code';
import { usePreferences } from '../../preferences';
import type { Workspace } from '../../projects';
import type { useWalkthroughProgress } from '../queries/walkthrough';
import { diffPresentation } from '../rules/diff-presentation';
import {
  foldThreads,
  foldedThread,
  threadOnRevision,
  threadSummary,
} from '../rules/thread-folds';
import { FileActionMenu } from './file-action-menu';
import type { WalkthroughRoutes } from './walkthrough-routes';
import { ReviewReadState } from './read-state';
import { RevisionReviewedAction } from './review-actions';

type DecisionStop = Extract<WalkthroughStop, { kind: 'decision' }>;
type Progress = ReturnType<typeof useWalkthroughProgress>;

const STEPS_SHOWN = 4;
const changeLabels = { new: 'New', changed: 'Changed', removed: 'Removed' };

export function DecisionPage({
  workspace,
  review,
  revision,
  stop,
  progress,
  unavailable,
  go,
  routes,
  changedPaths,
}: {
  workspace: Workspace;
  review: ReviewResponse;
  revision: ReviewRevision | undefined;
  stop: DecisionStop;
  progress: Progress;
  unavailable: boolean;
  go: (key: WalkthroughKey) => void;
  routes: WalkthroughRoutes;
  changedPaths: readonly string[];
}) {
  const { layer } = stop;
  const discussion = useAtomValue(
    revision
      ? readReviewComments({
          connection: workspace.connection,
          reviewId: revision.reviewId,
        })
      : readCommentThreads({
          connection: workspace.connection,
          scope: workspace.scope,
        }),
  );
  const questions = decisionQuestions(review, stop);
  const replies = AsyncResult.isSuccess(discussion)
    ? discussion.value.filter((thread) => {
        const anchor = thread.anchor;
        if (anchor.kind !== 'change') return false;
        const target = anchor.reviewTarget;
        return (
          (target?.kind === 'decision' && target.id === layer.id) ||
          (target?.kind === 'question' &&
            questions.some((question) => question.id === target.id))
        );
      })
    : [];

  const [allSteps, setAllSteps] = useState(false);
  const links = decisionLinks(review, layer.id);
  const route = decisionRoute(layer);
  const tally = filesReviewed(stop.paths, progress.items);
  const steps = allSteps ? layer.steps : layer.steps.slice(0, STEPS_SHOWN);
  return (
    <Box gap={4}>
      <Box className="flex-row items-center justify-between" gap={2}>
        {progress.states.get(layer.id)?.stale ? (
          <Badge label="Code moved since it was explained" variant="outline" />
        ) : (
          <Box />
        )}
        {progress.settled && tally.total > 0 ? (
          <Text variant="caption" tone="muted">
            {tally.reviewed} of {tally.total} files
          </Text>
        ) : null}
      </Box>
      <Box gap={2}>
        <Text variant="title" accessibilityRole="header" selectable>
          {layer.title}
        </Text>
        <Text variant="body" tone="muted" selectable>
          {layer.summary}
        </Text>
      </Box>
      {revision ? (
        <ReviewRequest
          label="Teach me"
          body={teachRequest(layer)}
          target={{ kind: 'decision', id: layer.id }}
          revision={revision}
          connection={workspace.connection}
        />
      ) : null}
      {replies.map((thread) => (
        <Card key={thread.id} padding={4} gap={1}>
          {thread.messages.map((message) => (
            <Text key={message.id} variant="secondary" selectable>
              {message.body}
            </Text>
          ))}
          <Button
            label="Open discussion"
            variant="plain"
            size="sm"
            onPress={() => routes.openThread(thread.id)}
          />
        </Card>
      ))}
      {layer.alternatives?.length ? (
        <Box gap={1}>
          <Text variant="caption" weight="medium">
            What else was considered
          </Text>
          {layer.alternatives.map((alternative) => (
            <Text key={alternative.label} variant="secondary" selectable>
              {alternative.label} · {alternative.whyNot}
            </Text>
          ))}
        </Box>
      ) : null}
      {links.length > 0 ? (
        <Box
          className="flex-row flex-wrap items-center"
          gap={2}
          accessible
          accessibilityLabel={`Contracts: ${links
            .map((link) =>
              link.outgoing
                ? `${link.verb} ${link.part.label}`
                : `${link.part.label} ${link.verb}`,
            )
            .join(', ')}`}
        >
          {links.map((link) => (
            <Box
              key={link.part.id}
              className="flex-row items-center"
              gap={1}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text variant="caption" tone="muted">
                {link.outgoing ? link.verb : link.part.label}
              </Text>
              <Text variant="caption" weight="medium">
                {link.outgoing ? link.part.label : link.verb}
              </Text>
              {link.change ? (
                <Badge
                  label={changeLabels[link.change]}
                  variant={link.change === 'new' ? 'default' : 'outline'}
                />
              ) : null}
            </Box>
          ))}
        </Box>
      ) : null}
      {questions.map((part) => (
        <Card key={part.id} variant="warning" padding={4} gap={2}>
          <Text variant="secondary" weight="medium">
            Needs your decision · {part.label}
          </Text>
          <Text variant="secondary" selectable>
            {part.problem}
          </Text>
          {part.options?.map((option) => (
            <Box key={option.id} gap={1}>
              <Text variant="secondary" selectable>
                {option.label} · {option.consequence}
              </Text>
              {revision ? (
                <>
                  <>
                    {review.proof.assets
                      .filter((asset) => asset.optionId === option.id)
                      .map((asset) => (
                        <ProofAsset
                          key={asset.id}
                          asset={asset}
                          revision={revision}
                          connection={workspace.connection}
                        />
                      ))}
                  </>
                  <ReviewRequest
                    label={`Choose ${option.label}`}
                    body={optionRequest(part, option)}
                    target={{ kind: 'question', id: part.id }}
                    revision={revision}
                    connection={workspace.connection}
                  />
                </>
              ) : null}
            </Box>
          ))}
          <Button
            label="Answer"
            accessibilityLabel={`Answer: ${part.label}`}
            variant="tonal"
            size="sm"
            onPress={() =>
              routes.compose(review, questionAnswer(part.problem ?? '', ''))
            }
          />
        </Card>
      ))}
      {layer.steps.length > 0 ? (
        <Box gap={1}>
          <Box className="flex-row items-center justify-between" gap={2}>
            <Text variant="caption" weight="medium" className="flex-1">
              {route.length > 0 ? route.join(' → ') : 'Steps'}
            </Text>
            {layer.steps.length > STEPS_SHOWN ? (
              <Button
                label={allSteps ? 'Fewer' : `All ${layer.steps.length}`}
                accessibilityLabel={
                  allSteps
                    ? 'Show fewer steps'
                    : `Show all ${layer.steps.length} steps`
                }
                variant="plain"
                onPress={() => setAllSteps(!allSteps)}
              />
            ) : null}
          </Box>
          {steps.map((step, index) => {
            const blocked = step.location.state === 'broken' || unavailable;
            return (
              <Item
                key={step.id}
                size="compact"
                title={step.title}
                titleNumberOfLines={2}
                description={[
                  step.pointer.path,
                  layer.lanes[step.lane],
                  step.kind === 'context' ? 'existing code' : undefined,
                  step.location.state === 'changed' ? 'code moved' : undefined,
                  step.location.state === 'broken'
                    ? 'code no longer available'
                    : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                leading={
                  <Text variant="caption" tone="muted">
                    {index + 1}
                  </Text>
                }
                disabled={blocked}
                accessibilityLabel={`Read step ${index + 1}: ${step.title}, ${step.pointer.path}`}
                {...(blocked
                  ? {}
                  : { onPress: () => routes.openStep(stop.key, step.id) })}
              />
            );
          })}
        </Box>
      ) : null}
      {revision ? (
        <RevisionDiffs
          workspace={workspace}
          progress={progress}
          revision={revision}
          stop={stop}
          changedPaths={changedPaths}
          routes={routes}
        />
      ) : null}
      {revision
        ? layer.steps.map((step) => (
            <ReviewRequest
              key={`guard-${step.id}`}
              label={`Ask for a guard · ${step.title}`}
              body={guardRequest(step)}
              revision={revision}
              connection={workspace.connection}
            />
          ))
        : null}
      {stop.elsewhere.map((file) => (
        <Button
          key={file.path}
          label={`${file.path} · shown in ${elsewhereLabel(review, file.stop)}`}
          accessibilityLabel={`Open owning stop for ${file.path}`}
          variant="plain"
          onPress={() => go(file.stop)}
        />
      ))}
    </Box>
  );
}

function elsewhereLabel(review: ReviewResponse, key: WalkthroughKey) {
  if (key === 'specs') return 'Specs';
  const index = review.layers.findIndex(
    (layer) => decisionKey(layer.id) === key,
  );
  return index < 0 ? 'another stop' : `decision ${index + 1}`;
}

export function RevisionDiffs({
  workspace,
  progress,
  revision,
  stop,
  changedPaths,
  routes,
}: {
  workspace: Workspace;
  progress: Progress;
  revision: ReviewRevision;
  stop: Exclude<WalkthroughStop, { kind: 'briefing' }>;
  changedPaths: readonly string[];
  routes: WalkthroughRoutes;
}) {
  const [shown, setShown] = useState(DECISION_DIFF_FILES);
  const threads = useAtomValue(
    readCommentThreads({
      connection: workspace.connection,
      scope: workspace.scope,
    }),
  );
  const files = revision.files.filter((file) => stop.paths.includes(file.path));
  if (files.length === 0) return null;
  return (
    <Box gap={3}>
      {files.slice(0, shown).map((file) => (
        <FileDiff
          key={file.path}
          workspace={workspace}
          revision={revision}
          file={file}
          reviewed={
            progress.settled
              ? progress.items.find((item) => item.path === file.path)
              : undefined
          }
          threads={
            AsyncResult.isSuccess(threads)
              ? threads.value.filter(
                  (thread) => anchorPath(thread.anchor) === file.path,
                )
              : []
          }
          changed={changedPaths.includes(file.path)}
          routes={routes}
        />
      ))}
      {files.length > shown ? (
        <Button
          label="Read more files"
          variant="tonal"
          onPress={() => setShown(shown + DECISION_DIFF_FILES)}
        />
      ) : null}
    </Box>
  );
}

function FileDiff({
  workspace,
  revision,
  file,
  reviewed,
  threads,
  changed,
  routes,
}: {
  workspace: Workspace;
  revision: ReviewRevision;
  file: ReviewRevision['files'][number];
  reviewed: Progress['items'][number] | undefined;
  threads: readonly CommentThread[];
  changed: boolean;
  routes: WalkthroughRoutes;
}) {
  const onThread = (thread: CommentThread) => routes.openThread(thread.id);
  const { preferences } = usePreferences();
  const query = readReviewRevisionDiffs({
    connection: workspace.connection,
    reviewId: revision.reviewId,
    revision: revision.revision,
    paths: [
      [
        ...new Set(
          [file.oldPath, file.newPath, file.path].filter(
            (path) => path !== undefined,
          ),
        ),
      ],
    ],
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  const content = AsyncResult.isSuccess(result)
    ? result.value.diffs.find((item) => item.paths.includes(file.path))?.content
    : undefined;
  const presentation = content ? diffPresentation(content) : undefined;
  const lines = presentation?.kind === 'text' ? presentation.lines : [];
  const folded = foldThreads(lines, threads, revision);
  const added = lines.filter((line) => line.kind === 'added').length;
  const removed = lines.filter((line) => line.kind === 'removed').length;
  const language = sourceLanguage(file.path);
  const open = (lineId: string) => {
    const thread = threads.find((entry) => entry.id === foldedThread(lineId));
    if (thread) onThread(thread);
  };
  let body = (
    <Box paddingX={4} paddingY={2}>
      <Text variant="caption" tone="muted">
        {diffNotice(presentation)}
      </Text>
    </Box>
  );
  if (!AsyncResult.isSuccess(result))
    body = <ReviewReadState result={result} refresh={refresh} />;
  else if (presentation?.kind === 'text')
    body = (
      <Box className={diffHeight(folded.lines.length)}>
        <DiffView
          lines={folded.lines}
          wrap={preferences.lineOverflow === 'wrap'}
          onExpand={open}
          {...(language ? { language } : {})}
        />
      </Box>
    );
  return (
    <Card className="overflow-hidden">
      <Box
        className="flex-row items-center justify-between"
        gap={2}
        paddingX={4}
        paddingY={2}
        divider="bottom"
      >
        <Text variant="code" numberOfLines={1} className="flex-1">
          {file.path}
        </Text>
        {presentation?.kind === 'text' ? (
          <Text
            variant="caption"
            tone="muted"
            accessibilityLabel={`${removed} lines removed, ${added} lines added`}
          >
            −{removed} +{added}
          </Text>
        ) : null}
        <FileActionMenu
          label={`Actions for ${file.path}`}
          actions={[
            ...(changed
              ? [
                  {
                    id: 'diff' as const,
                    label: 'Open changed-file diff',
                    onPress: () => routes.openChangedFile(file.path),
                  },
                ]
              : []),
            ...(file.status === 'deleted'
              ? []
              : [
                  {
                    id: 'files' as const,
                    label: 'Open in Files',
                    onPress: () => routes.openInFiles(file.path),
                  },
                ]),
            {
              id: 'history' as const,
              label: 'File history',
              onPress: () => routes.openFileHistory(file.path),
            },
          ]}
        />
      </Box>
      {body}
      {reviewed ? (
        <Box paddingX={4} paddingY={2}>
          <RevisionReviewedAction
            workspace={workspace}
            revision={revision}
            file={reviewed}
          />
        </Box>
      ) : null}
      {folded.unplaced.map((thread) => (
        <Item
          key={thread.id}
          size="compact"
          title={threadSummary(thread)}
          description={unplacedLabel(thread, revision)}
          leading={<Icon name="comment" tone="muted" />}
          trailing={<Icon name="chevron" tone="muted" />}
          accessibilityLabel={`Open thread: ${threadSummary(thread)}, ${unplacedLabel(thread, revision)}`}
          onPress={() => onThread(thread)}
        />
      ))}
    </Card>
  );
}

function unplacedLabel(thread: CommentThread, revision: ReviewRevision) {
  const anchor = thread.anchor;
  if (anchor.kind !== 'codeRange') return 'Whole file';
  const lines =
    anchor.startLine === anchor.endLine
      ? `Line ${anchor.startLine}`
      : `Lines ${anchor.startLine}–${anchor.endLine}`;
  return threadOnRevision(thread, revision)
    ? `${lines} · outside this diff`
    : `${lines} · written on other code`;
}

function diffNotice(
  presentation: ReturnType<typeof diffPresentation> | undefined,
) {
  if (presentation?.kind === 'notice')
    return `${presentation.title} · ${presentation.description}`;
  if (presentation?.kind === 'metadata')
    return 'Metadata only · no text lines changed';
  return 'This file has no diff in the published revision.';
}

function diffHeight(lines: number) {
  if (lines <= 8) return 'h-48';
  if (lines <= 16) return 'h-80';
  return 'h-96';
}
