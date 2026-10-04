import { Button, Host, RNHostView } from '@expo/ui';
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
  return (
    <RNHostView>
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-4 px-6 py-8">
          <Text
            accessibilityRole="header"
            className="text-xl font-semibold text-foreground"
          >
            Comments
          </Text>
          <Host matchContents={{ vertical: true }}>
            <Button label="Close comments" onPress={onClose} />
          </Host>
          {comments.isPending ? (
            <Text className="text-sm text-muted-foreground">
              Reading comments…
            </Text>
          ) : null}
          {comments.error ? (
            <>
              <Text
                accessibilityRole="alert"
                className="text-sm text-destructive"
              >
                Could not read comments.
              </Text>
              <Host matchContents={{ vertical: true }}>
                <Button label="Read comments again" onPress={comments.read} />
              </Host>
            </>
          ) : null}
          {!comments.isPending &&
          !comments.error &&
          comments.threads.length === 0 ? (
            <Text className="text-sm text-muted-foreground">
              No comments yet.
            </Text>
          ) : null}
          {comments.threads.map((thread) => (
            <View
              key={thread.id}
              className="gap-2 rounded-lg border border-border p-4"
            >
              <Text className="text-sm font-medium text-foreground">
                {thread.anchor.kind === 'change'
                  ? 'All changes'
                  : thread.anchor.filePath}
                {thread.anchor.kind === 'codeRange'
                  ? ` · ${thread.anchor.startLine}–${thread.anchor.endLine}${thread.anchor.side === 'deletions' ? ' (old)' : ''}`
                  : ''}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {thread.resolved ? 'Resolved' : 'Open'}
                {thread.anchor.comparison
                  ? ` · ${thread.anchor.comparison.kind}`
                  : ''}
              </Text>
              {thread.messages.map((message) => (
                <View key={message.id} className="gap-1">
                  <Text className="text-xs text-muted-foreground">
                    {message.author === 'reviewer' ? 'Reviewer' : 'Agent'}
                  </Text>
                  <Text
                    selectable
                    className="text-sm leading-6 text-foreground"
                  >
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
