import { Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import {
  commitFileLabel,
  type CommitFile,
} from '@porcelain/client/history/rules';
import { Button } from '../../../shared/ui/button';

export function CommitFileRow({
  file,
  onOpen,
}: {
  file: CommitFile;
  onOpen: () => void;
}) {
  const inset = useResolveClassNames('mx-4 border-b border-border py-1');
  const content = useResolveClassNames(
    'min-w-0 flex-1 flex-row items-center gap-3',
  );
  const path = useResolveClassNames(
    'min-w-0 flex-1 font-mono text-sm leading-5 text-foreground',
  );
  const badge = useResolveClassNames(
    'rounded-md border border-border bg-muted/25 px-2 py-0.5',
  );
  const status = useResolveClassNames('text-xs text-muted-foreground');
  return (
    <View style={inset}>
      <Button
        label={commitFileLabel(file)}
        accessibilityLabel={`${commitFileLabel(file)}, ${file.status}`}
        testID={`history-file-${file.newPath ?? file.oldPath}`}
        variant="ghost"
        size="row"
        onPress={onOpen}
      >
        <View style={content}>
          <Text numberOfLines={2} style={path}>
            {commitFileLabel(file)}
          </Text>
          <View style={badge}>
            <Text style={status}>{file.status}</Text>
          </View>
        </View>
      </Button>
    </View>
  );
}
