import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { externalLink } from '@porcelain/client/links/rules';
import { parseMarkdown, type MarkdownBlock } from '../../shared/rules/markdown';
import { Text } from './text';

function Runs({
  block,
  onLink,
}: {
  block: MarkdownBlock;
  onLink: ((url: string) => void) | undefined;
}) {
  return block.runs.map((run, index) => {
    const url = run.url;
    const link = url !== undefined && externalLink(url) ? url : undefined;
    return (
      <Text
        key={index}
        variant="secondary"
        tone={link ? 'brand' : 'default'}
        weight={run.bold ? 'semibold' : 'normal'}
        mark={run.code ? 'code' : undefined}
        {...(link && onLink
          ? { accessibilityRole: 'link' as const, onPress: () => onLink(link) }
          : {})}
      >
        {run.text}
      </Text>
    );
  });
}

function MarkdownImage({
  block,
  onLink,
}: {
  block: MarkdownBlock;
  onLink: ((url: string) => void) | undefined;
}) {
  const alt = block.runs.map((run) => run.text).join('');
  const url =
    block.url !== undefined && externalLink(block.url) ? block.url : undefined;
  const [shape, setShape] = useState<number | 'failed'>();
  if (url === undefined || shape === 'failed')
    return (
      <Text variant="caption" tone="muted">
        {`Image unavailable: ${alt}`}
      </Text>
    );
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={alt}
      disabled={!onLink}
      onPress={() => onLink?.(url)}
      className="w-full overflow-hidden rounded-md border border-border bg-muted"
    >
      <Image
        source={{ uri: url }}
        accessible={false}
        resizeMode="contain"
        className="w-full"
        style={{ aspectRatio: typeof shape === 'number' ? shape : 16 / 9 }}
        onLoad={({ nativeEvent: { source } }) =>
          setShape(source.height > 0 ? source.width / source.height : 16 / 9)
        }
        onError={() => setShape('failed')}
      />
    </Pressable>
  );
}

export function MarkdownText({
  source,
  onLink,
}: {
  source: string;
  onLink?: ((url: string) => void) | undefined;
}) {
  return (
    <View className="gap-2">
      {parseMarkdown(source).map((block) => {
        switch (block.kind) {
          case 'heading':
            return (
              <Text
                key={block.id}
                variant={block.level <= 2 ? 'headline' : 'secondary'}
                weight="semibold"
              >
                {block.runs.map((run) => run.text).join('')}
              </Text>
            );
          case 'code':
            return (
              <View
                key={block.id}
                className="rounded-md border border-border bg-muted px-2.5 py-2"
              >
                <Text variant="mono" selectable>
                  {block.runs.map((run) => run.text).join('')}
                </Text>
              </View>
            );
          case 'quote':
            return (
              <View key={block.id} className="border-l-2 border-border pl-3">
                <Text variant="secondary" tone="muted">
                  <Runs block={block} onLink={onLink} />
                </Text>
              </View>
            );
          case 'image':
            return (
              <MarkdownImage key={block.id} block={block} onLink={onLink} />
            );
          default:
            return (
              <View
                key={block.id}
                className={block.kind === 'list' ? 'pl-2' : ''}
              >
                <Text variant="secondary" selectable>
                  <Runs block={block} onLink={onLink} />
                </Text>
              </View>
            );
        }
      })}
    </View>
  );
}
