import { useState } from 'react';
import { Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { childFilePath } from '@porcelain/client/files/rules';
import { Button } from '../../../shared/ui/button';
import { useDirectory } from '../queries/reads';
import { ReadState } from './read-state';
import { FileRow } from './file-row';

function Folder({
  context,
  path,
  name,
  onOpen,
}: {
  context: Parameters<typeof useDirectory>[0];
  path: string;
  name: string;
  onOpen: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const branch = useResolveClassNames('ml-5 border-l border-border pl-2');
  return (
    <View>
      <Button
        label={`${expanded ? 'Collapse' : 'Expand'} ${name}`}
        variant="ghost"
        size="row"
        onPress={() => setExpanded(!expanded)}
      >
        <FileRow name={name} expanded={expanded} />
      </Button>
      {expanded ? (
        <View style={branch}>
          <FileTree context={context} path={path} onOpen={onOpen} />
        </View>
      ) : null}
    </View>
  );
}

export function FileTree({
  context,
  path,
  onOpen,
}: {
  context: Parameters<typeof useDirectory>[0];
  path: string;
  onOpen: (path: string) => void;
}) {
  const query = useDirectory(context, path);
  const empty = useResolveClassNames(
    'px-4 py-4 text-sm leading-6 text-muted-foreground',
  );
  if (query.isPending || query.isError)
    return (
      <ReadState
        pending={query.isPending}
        error={query.error}
        onRead={() => {
          void query.refetch();
        }}
      />
    );
  return (
    <View>
      {query.data.entries.length === 0 ? (
        <Text style={empty}>This folder is empty.</Text>
      ) : null}
      {query.data.entries.map((entry) => {
        const child = childFilePath(path, entry.name);
        return entry.kind === 'directory' ? (
          <Folder
            key={child}
            context={context}
            path={child}
            name={entry.name}
            onOpen={onOpen}
          />
        ) : (
          <Button
            key={child}
            label={entry.name}
            variant="ghost"
            size="row"
            disabled={entry.kind !== 'file'}
            onPress={() => onOpen(child)}
          >
            <FileRow
              name={entry.name}
              {...(entry.kind === 'file' ? {} : { detail: entry.kind })}
            />
          </Button>
        );
      })}
    </View>
  );
}
