import { RNHostView } from '@expo/ui';
import { useResolveClassNames } from 'uniwind';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { ScrollView, Text, View } from 'react-native';
import { useComments } from '../queries/review';

export function CommentsSheet({
  scope,
  connection,
  onClose,
}: {
  scope: Parameters<typeof useComments>[0];
  connection: Parameters<typeof useComments>[1];
  onClose: () => void;
}) {
  const comments = useComments(scope, connection);
  const surface = useResolveClassNames('flex-1 bg-background');
  const contents = useResolveClassNames('px-4 py-6');
  const stack = useResolveClassNames('gap-4');
  const toolbar = useResolveClassNames(
    'flex-row flex-wrap items-center justify-between gap-2',
  );
  const title = useResolveClassNames('text-lg font-semibold text-foreground');
  const heading = useResolveClassNames(
    'text-sm font-medium text-card-foreground',
  );
  const text = useResolveClassNames('text-sm leading-6 text-card-foreground');
  const metadata = useResolveClassNames(
    'text-xs leading-5 text-muted-foreground',
  );
  const alert = useResolveClassNames('text-sm text-destructive');
  const card = useResolveClassNames(
    'gap-3 rounded-lg border border-border bg-card p-3',
  );
  const messageStyle = useResolveClassNames('gap-1');
  return (
    <RNHostView>
      <ScrollView
        style={surface}
        contentContainerStyle={contents}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={stack}>
          <View style={toolbar}>
            <Text accessibilityRole="header" style={title}>
              Comments
            </Text>
            <Button
              label="Close comments"
              variant="outline"
              size="sm"
              onPress={onClose}
            />
          </View>
          {comments.isPending ? (
            <Text style={metadata}>Reading comments…</Text>
          ) : null}
          {comments.error ? (
            <>
              <Text accessibilityRole="alert" style={alert}>
                Could not read comments.
              </Text>
              <Button
                label="Read comments again"
                variant="outline"
                onPress={comments.read}
              />
            </>
          ) : null}
          {!comments.isPending &&
          !comments.error &&
          comments.threads.length === 0 ? (
            <Text style={metadata}>No comments yet.</Text>
          ) : null}
          {comments.threads.map((thread) => (
            <View key={thread.id} style={card}>
              <Text style={heading}>
                {thread.anchor.kind === 'change'
                  ? 'All changes'
                  : thread.anchor.filePath}
                {thread.anchor.kind === 'codeRange'
                  ? ` · ${thread.anchor.startLine}–${thread.anchor.endLine}${thread.anchor.side === 'deletions' ? ' (old)' : ''}`
                  : ''}
              </Text>
              <View style={toolbar}>
                <Badge
                  label={thread.resolved ? 'Resolved' : 'Open'}
                  variant="outline"
                />
                {thread.anchor.comparison ? (
                  <Text style={metadata}>{thread.anchor.comparison.kind}</Text>
                ) : null}
              </View>
              {thread.messages.map((message) => (
                <View key={message.id} style={messageStyle}>
                  <Text style={metadata}>
                    {message.author === 'reviewer' ? 'Reviewer' : 'Agent'}
                  </Text>
                  <Text selectable style={text}>
                    {message.body}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </RNHostView>
  );
}
