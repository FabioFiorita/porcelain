import { ErrorState } from '../../../components/ui/error-state';
import { Text } from '../../../components/ui/text';

export function PickerNotices({
  messages,
  error,
  onRead,
  reading,
}: {
  messages: readonly string[];
  error: string | undefined;
  onRead: () => void;
  reading: boolean;
}) {
  return (
    <>
      {messages.map((message) => (
        <Text key={message} variant="caption" tone="muted">
          {message}
        </Text>
      ))}
      {error ? (
        <ErrorState
          message={error}
          retry={{ label: 'Read again', onPress: onRead, pending: reading }}
        />
      ) : null}
    </>
  );
}
