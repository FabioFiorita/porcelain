import { Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { codeFont } from './code-font';

export type FileDiffRow = {
  id: string;
  kind:
    | 'header'
    | 'metadata'
    | 'hunk'
    | 'context'
    | 'addition'
    | 'deletion'
    | 'notice'
    | 'raw';
  text: string;
  oldLine?: number;
  newLine?: number;
  accessibilityLabel: string;
  tokens: readonly {
    text: string;
    kind: 'plain' | 'string' | 'comment' | 'keyword' | 'number';
  }[];
};

export function DiffLine({
  row,
  gutterWidth,
}: {
  row: FileDiffRow;
  gutterWidth: number;
}) {
  const code =
    row.kind === 'context' ||
    row.kind === 'addition' ||
    row.kind === 'deletion';
  const surface = useResolveClassNames(
    `min-h-5 flex-row items-start ${row.kind === 'addition' ? 'bg-graph-2/10 dark:bg-graph-2/20' : row.kind === 'deletion' ? 'bg-graph-6/10 dark:bg-graph-6/20' : row.kind === 'header' ? 'border-y border-border bg-muted px-3 py-2' : row.kind === 'hunk' ? 'bg-muted px-3 py-1' : code ? 'bg-card' : 'bg-card px-3 py-1'}`,
  );
  const source = useResolveClassNames(
    'text-[13px] leading-5 text-card-foreground',
  );
  const gutter = useResolveClassNames(
    'pr-2 text-right text-xs leading-5 text-muted-foreground',
  );
  const marker = useResolveClassNames(
    `w-5 text-center text-[13px] leading-5 ${row.kind === 'addition' ? 'text-graph-2' : row.kind === 'deletion' ? 'text-graph-6' : 'text-muted-foreground'}`,
  );
  const heading = useResolveClassNames(
    'text-sm leading-5 font-medium text-card-foreground',
  );
  const metadata = useResolveClassNames(
    'text-xs leading-5 text-muted-foreground',
  );
  const string = useResolveClassNames('text-graph-2');
  const keyword = useResolveClassNames('text-graph-1');
  const number = useResolveClassNames('text-graph-3');
  const comment = useResolveClassNames('text-muted-foreground');
  const tokenStyles = { plain: undefined, string, keyword, number, comment };
  return (
    <View
      accessible
      accessibilityLabel={row.accessibilityLabel}
      testID={row.id}
      style={surface}
    >
      {code ? (
        <>
          <Text
            accessible={false}
            style={[gutter, { width: gutterWidth, fontFamily: codeFont }]}
          >
            {row.oldLine ?? ''}
          </Text>
          <Text
            accessible={false}
            style={[gutter, { width: gutterWidth, fontFamily: codeFont }]}
          >
            {row.newLine ?? ''}
          </Text>
          <Text accessible={false} style={[marker, { fontFamily: codeFont }]}>
            {row.kind === 'addition'
              ? '+'
              : row.kind === 'deletion'
                ? '−'
                : ' '}
          </Text>
        </>
      ) : null}
      <Text
        accessible={false}
        selectable
        style={[
          row.kind === 'header'
            ? heading
            : code || row.kind === 'raw'
              ? source
              : metadata,
          row.kind === 'header' ? undefined : { fontFamily: codeFont },
        ]}
      >
        {code
          ? row.tokens.map((token, index) => (
              <Text key={index} style={tokenStyles[token.kind]}>
                {token.text}
              </Text>
            ))
          : row.text}
      </Text>
    </View>
  );
}
