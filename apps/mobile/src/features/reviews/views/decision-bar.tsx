import { SafeAreaView } from 'react-native-screens/experimental';
import {
  stopTitle,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { Text } from '../../../components/ui/text';
import {
  CompletionNotice,
  type useStopCompletion,
} from './walkthrough-completion';

export function DecisionBar({
  stop,
  previous,
  next,
  go,
  completion,
  onComment,
}: {
  stop: Exclude<WalkthroughStop, { kind: 'briefing' }>;
  previous: WalkthroughStop | undefined;
  next: WalkthroughStop | undefined;
  go: (key: WalkthroughKey) => void;
  completion: ReturnType<typeof useStopCompletion>;
  onComment: () => void;
}) {
  const { finished, plan, layer, disabled, pending } = completion;
  let label = plan.action ?? 'Mark files reviewed';
  if (layer) label = plan.action ?? 'Mark decision reviewed';
  if (finished) label = layer ? 'Unmark reviewed' : 'Files reviewed';
  return (
    <SafeAreaView
      edges={{ bottom: true }}
      insetType="system"
      style={{ flex: 0 }}
    >
      <Box paddingX={4} paddingY={3} gap={2} surface="background">
        {plan.explanation && !finished ? (
          <Text variant="caption" tone="muted">
            {plan.explanation}
          </Text>
        ) : null}
        <CompletionNotice notice={completion.notice} />
        <Box className="flex-row items-center" gap={2}>
          <IconButton
            icon="previous"
            variant="outline"
            accessibilityLabel={
              previous
                ? `Previous stop: ${stopTitle(previous)}`
                : 'Previous stop'
            }
            disabled={!previous}
            onPress={() => previous && go(previous.key)}
          />
          <Box className="flex-1">
            <Button
              label={label}
              variant={finished ? 'outline' : 'default'}
              accessibilityLabel={
                finished
                  ? layer
                    ? `Unmark decision ${stopTitle(stop)} as unreviewed`
                    : `${stopTitle(stop)} files reviewed`
                  : completion.markLabel
              }
              disabled={disabled || (finished && !layer)}
              pending={pending}
              onPress={() =>
                finished
                  ? completion.reopen()
                  : completion.complete(completion.advance)
              }
            />
          </Box>
          <IconButton
            icon="comment"
            variant="outline"
            accessibilityLabel={`Comment on ${stopTitle(stop)}`}
            onPress={onComment}
          />
          <IconButton
            icon="chevron"
            variant="outline"
            accessibilityLabel={
              next ? `Next stop: ${stopTitle(next)}` : 'Next stop'
            }
            disabled={!next}
            onPress={() => next && go(next.key)}
          />
        </Box>
      </Box>
    </SafeAreaView>
  );
}
