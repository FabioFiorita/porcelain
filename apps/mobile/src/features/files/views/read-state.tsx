import { ActivityIndicator, Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { fileReadError } from '@porcelain/client/files/rules';
import { Button } from '../../../shared/ui/button';

export function ReadState({
  query,
}: {
  query: {
    isPending: boolean;
    error: unknown;
    refetch: () => Promise<unknown>;
  };
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
          {query.isPending ? (
            <ActivityIndicator
              color={
                typeof message.color === 'string' ? message.color : undefined
              }
            />
          ) : null}
          <Text style={message}>
            {query.isPending ? 'Reading files…' : fileReadError(query.error)}
          </Text>
        </View>
        {query.isPending ? null : (
          <Button
            label="Read again"
            size="sm"
            onPress={() => {
              void query.refetch();
            }}
          />
        )}
      </View>
    </View>
  );
}
