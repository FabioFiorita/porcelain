import { Separator } from '../../../components/ui/separator';
import { useState, type ReactNode } from 'react';
import { useAtom } from '@effect/atom-react';
import { View } from 'react-native';
import {
  commentIsStale,
  matchesCommentTarget,
  type CommentTarget,
  type CommentAnchor,
} from '@porcelain/client/reviews/rules';
import type { ReviewRange } from '../../../components/ui/review-annotation';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import { documentCommentAnchor } from '../rules/document-comment';
import { CommentThreads } from './review-comments-screen';
import type { CommentWorkspace } from './comment-draft';
import { documentSelectionState } from '../store';

export type DocumentCodeSelection = {
  selection: ReviewRange | undefined;
  onSelect: ((range: ReviewRange) => void) | undefined;
};

export function DocumentComments({
  workspace,
  path,
  document,
  target,
  renderToolbar,
  children,
  selectable = true,
  leaveScope,
}: {
  workspace: CommentWorkspace;
  path: string;
  document: string;
  target?: CommentTarget | undefined;
  selectable?: boolean;
  leaveScope?: string | undefined;
  renderToolbar?: ((actions: ReactNode) => ReactNode) | undefined;
  children: (props: DocumentCodeSelection) => ReactNode;
}) {
  const [selected, setSelected] = useAtom(
    documentSelectionState({
      environmentId: workspace.connection.environmentId,
      ...workspace.scope,
      document,
      comparison: target?.comparison,
    }),
  );
  const [composing, setComposing] = useState<CommentAnchor>();
  const selection: ReviewRange | undefined =
    composing?.kind === 'codeRange'
      ? {
          startLine: composing.startLine,
          endLine: composing.endLine,
          ...(composing.side ? { side: composing.side } : {}),
        }
      : selected?.range;
  const [showComments, setShowComments] = useState(selected !== undefined);
  const anchor = documentCommentAnchor(selected?.target ?? target, selection);
  const actions = (
    <>
      <Button
        label={showComments ? 'Hide comments' : 'Comments'}
        variant="outline"
        size="sm"
        onPress={() => setShowComments(!showComments)}
      />
      {selection ? (
        <Button
          label="Clear selection"
          variant="ghost"
          size="sm"
          disabled={composing !== undefined}
          onPress={() => setSelected(undefined)}
        />
      ) : null}
    </>
  );
  return (
    <View className="flex-1">
      {renderToolbar ? (
        renderToolbar(actions)
      ) : (
        <Box
          className="flex-row flex-wrap items-center"
          gap={2}
          paddingX={4}
          paddingY={2}
        >
          {actions}
        </Box>
      )}
      {!target ? (
        <Box paddingX={4} paddingY={2}>
          <Text variant="caption" tone="muted">
            The current saved code could not be confirmed. Existing comments and
            unsent drafts retain their earlier targets.
          </Text>
        </Box>
      ) : null}
      {anchor &&
      target &&
      (commentIsStale(anchor, target) ||
        !matchesCommentTarget(anchor, target)) ? (
        <Box paddingX={4} paddingY={2}>
          <Text variant="caption" tone="muted">
            Code changed since selection. Clear it and select the current saved
            code to update the target.
          </Text>
        </Box>
      ) : null}
      <View className="min-h-32 flex-1">
        {children({
          selection,
          onSelect:
            target && selectable && !composing
              ? (range) => {
                  setSelected({ range, target });
                  setShowComments(true);
                }
              : undefined,
        })}
      </View>
      <View className={showComments ? 'min-h-40 flex-1' : 'hidden'}>
        <Separator />
        <CommentThreads
          leaveScope={leaveScope}
          workspace={workspace}
          path={path}
          anchor={anchor}
          currentTarget={target}
          compose={false}
          onComposerChange={setComposing}
        />
      </View>
    </View>
  );
}
