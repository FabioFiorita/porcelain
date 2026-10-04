import type { useDirectory } from '../queries/reads';
import { Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { Button } from '../../../shared/ui/button';
import { useFileText } from '../queries/reads';
import { ReadState } from './read-state';
import { CodeView } from './code-view';

export function FileView({
  context,
  path,
  onBack,
}: {
  context: Parameters<typeof useDirectory>[0];
  path: string;
  onBack: () => void;
}) {
  const query = useFileText(context, path);
  const text = query.data && !('kind' in query.data) ? query.data.text : '';
  const count = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  const numbers = Array.from({ length: count }, (_, index) => index + 1).join(
    '\n',
  );
  const surface = useResolveClassNames('flex-1 bg-background');
  const header = useResolveClassNames(
    'gap-3 border-b border-border bg-card px-4 py-3',
  );
  const actions = useResolveClassNames(
    'flex-row items-center justify-between gap-3',
  );
  const identity = useResolveClassNames('gap-2');
  const title = useResolveClassNames('text-sm font-medium text-foreground');
  const badge = useResolveClassNames(
    'self-start rounded-md border border-border bg-muted px-2 py-1',
  );
  const metadata = useResolveClassNames('text-xs text-muted-foreground');
  const state = useResolveClassNames(
    'px-4 py-6 text-sm leading-6 text-muted-foreground',
  );
  return (
    <View style={surface}>
      <View style={header}>
        <View style={actions}>
          <Button
            label="Back to files"
            variant="ghost"
            size="sm"
            onPress={onBack}
          />
          <Button
            label={query.isFetching ? 'Reloading file…' : 'Reload file'}
            size="sm"
            disabled={query.isFetching}
            onPress={() => {
              void query.refetch();
            }}
          />
        </View>
        <View style={identity}>
          <Text accessibilityRole="header" selectable style={title}>
            {path}
          </Text>
          <View style={badge}>
            <Text style={metadata}>Read only</Text>
          </View>
        </View>
      </View>
      {query.isPending || query.isError ? (
        <ReadState
          pending={query.isPending}
          error={query.error}
          onRead={() => {
            void query.refetch();
          }}
        />
      ) : 'kind' in query.data ? (
        <Text style={state}>{query.data.reason}</Text>
      ) : query.data.text === '' ? (
        <Text style={state}>This file is empty.</Text>
      ) : (
        <CodeView text={query.data.text} numbers={numbers} />
      )}
    </View>
  );
}
