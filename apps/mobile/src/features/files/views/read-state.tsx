import { ActivityIndicator, Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { fileReadError } from '@porcelain/client/files/rules';
import { Button } from '../../../shared/ui/button';

export function ReadState({
  pending,
  error,
  onRead,
}: {
  pending: boolean;
  error: unknown;
  onRead: () => void;
}) {
  const card = useResolveClassNames(
    'gap-3 rounded-lg border border-border bg-card p-4',
  );
  const inset = useResolveClassNames('p-4');
  const message = useResolveClassNames(
    'flex-1 text-sm leading-6 text-muted-foreground',
  );
  const line = useResolveClassNames('flex-row items-center gap-3');
  return (
    <View style={inset}>
      <View style={card}>
        <View style={line}>
          {pending ? (
            <ActivityIndicator
              color={
                typeof message.color === 'string' ? message.color : undefined
              }
            />
          ) : null}
          <Text style={message}>
            {pending ? 'Reading files…' : fileReadError(error)}
          </Text>
        </View>
        {pending ? null : (
          <Button label="Read again" size="sm" onPress={onRead} />
        )}
      </View>
    </View>
  );
}
