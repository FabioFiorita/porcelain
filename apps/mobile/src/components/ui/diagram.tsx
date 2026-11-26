import { Pressable, ScrollView, View } from 'react-native';
import Svg, { G, Line, Path, Polygon } from 'react-native-svg';
import { useResolveClassNames } from 'uniwind';
import {
  diagramTextMeasure,
  type DiagramEdgeTone,
  type DiagramGeometry,
} from '@porcelain/client/walkthroughs/rules';
import { Icon } from './icon';
import { usePressRipple } from './press-ripple';
import { Text } from './text';

const EDGE_LABEL_HEIGHT = 16;
const LABEL_PAD = 4;

export const diagramMeasure = diagramTextMeasure({
  label: 7.3,
  note: 6.2,
  edge: 6.2,
  padding: 22,
  sign: 12,
  chevron: 0,
  min: 72,
  max: 200,
});

type DiagramMark = 'added' | 'removed' | 'changed' | 'unchanged';

export type DiagramCard = {
  readonly id: string;
  readonly label: string;
  readonly note: string | undefined;
  readonly sign: string | undefined;
  readonly mark: DiagramMark | undefined;
  readonly code: boolean;
  readonly comments: number;
  readonly description: string;
};

export type DiagramLine = {
  readonly index: number;
  readonly tone: DiagramEdgeTone;
  readonly dashed: boolean;
  readonly label: string | undefined;
};

const CARD_SURFACES: Record<DiagramMark | 'none', string> = {
  added: 'border-add-fg/40 bg-add-bg',
  removed: 'border-dashed border-del-fg/50 bg-background',
  changed: 'border-border bg-background',
  unchanged: 'border-border bg-background',
  none: 'border-border bg-background',
};

const SIGN_TONES = {
  added: 'add',
  removed: 'del',
  changed: 'muted',
  unchanged: 'muted',
} as const;

const LABEL_TONES = {
  add: 'add',
  del: 'del',
  lit: 'default',
  rest: 'muted',
} as const;

function useLineColors(): Record<DiagramEdgeTone | 'border', string> {
  const add = useResolveClassNames('text-add-fg');
  const del = useResolveClassNames('text-del-fg');
  const lit = useResolveClassNames('text-foreground');
  const rest = useResolveClassNames('text-muted-foreground');
  const border = useResolveClassNames('text-border');
  const color = (value: unknown) =>
    typeof value === 'string' ? value : '#84848a';
  return {
    add: color(add.color),
    del: color(del.color),
    lit: color(lit.color),
    rest: color(rest.color),
    border: color(border.color),
  };
}

function Card({
  card,
  selected,
  dim,
  onPress,
}: {
  card: DiagramCard;
  selected: boolean;
  dim: boolean;
  onPress: () => void;
}) {
  const ripple = usePressRipple('bounded');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={card.label}
      accessibilityHint={card.description}
      accessibilityState={{ selected }}
      onPress={onPress}
      android_ripple={ripple}
      className={[
        'size-full justify-center gap-0.5 rounded-md border px-2.5',
        CARD_SURFACES[card.mark ?? 'none'],
        selected ? 'border-foreground/60' : '',
        dim ? 'opacity-35' : '',
      ].join(' ')}
    >
      <View className="min-w-0 flex-row items-baseline gap-1">
        {card.sign ? (
          <Text
            variant="mono"
            tone={SIGN_TONES[card.mark ?? 'unchanged']}
            className="w-2"
          >
            {card.sign}
          </Text>
        ) : null}
        <Text
          variant={card.code ? 'mono' : 'caption'}
          tone={card.mark === 'removed' ? 'muted' : 'default'}
          decoration={card.mark === 'removed' ? 'line-through' : undefined}
          numberOfLines={1}
          className="min-w-0 flex-1"
        >
          {card.label}
        </Text>
      </View>
      {card.note ? (
        <View className={card.sign ? 'pl-3' : ''}>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {card.note}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Diagram({
  title,
  geometry,
  cards,
  lines,
  selected,
  near,
  onSelect,
  onWidth,
}: {
  title: string | undefined;
  geometry: DiagramGeometry;
  cards: readonly DiagramCard[];
  lines: readonly DiagramLine[];
  selected: string | undefined;
  near: { nodes: ReadonlySet<string>; edges: ReadonlySet<number> } | undefined;
  onSelect: (id: string) => void;
  onWidth: (width: number) => void;
}) {
  const colors = useLineColors();
  const half = (text: string) => diagramMeasure.label(text) / 2 + LABEL_PAD;
  const labelX = (x: number, text: string) =>
    Math.min(Math.max(x, half(text)), geometry.width - half(text));
  return (
    <View
      className="overflow-hidden rounded-md border border-border"
      accessibilityLabel={title ?? 'Diagram'}
    >
      {title ? (
        <View className="min-h-8 justify-center border-b border-border bg-muted/50 px-3 py-1">
          <Text variant="caption" tone="muted">
            {title}
          </Text>
        </View>
      ) : null}
      <View onLayout={(event) => onWidth(event.nativeEvent.layout.width)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerClassName="grow justify-center"
        >
          <View
            style={{ width: geometry.width, height: geometry.height }}
            accessibilityRole="list"
          >
            <Svg
              width={geometry.width}
              height={geometry.height}
              style={{ position: 'absolute' }}
              accessible={false}
            >
              {geometry.lifelines.map((line, index) => (
                <Line
                  key={index}
                  x1={line.x}
                  x2={line.x}
                  y1={line.top}
                  y2={line.bottom}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              ))}
              {geometry.edges.map((placed) => {
                const line = lines.find((item) => item.index === placed.index);
                if (!line) return null;
                const dim = near !== undefined && !near.edges.has(line.index);
                const color = colors[line.tone];
                return (
                  <G key={placed.index}>
                    <Path
                      d={placed.path}
                      fill="none"
                      stroke={color}
                      strokeWidth={1}
                      {...(line.dashed ? { strokeDasharray: '4 3' } : {})}
                      opacity={dim ? 0.25 : 1}
                    />
                    <Polygon
                      points={placed.arrow}
                      fill={color}
                      opacity={dim ? 0.25 : 1}
                    />
                  </G>
                );
              })}
            </Svg>
            {geometry.edges.map((placed) => {
              const line = lines.find((item) => item.index === placed.index);
              if (!placed.label || !line?.label) return null;
              const width = diagramMeasure.label(line.label);
              const dim = near !== undefined && !near.edges.has(line.index);
              return (
                <View
                  key={`label:${placed.index}`}
                  pointerEvents="none"
                  accessible={false}
                  className={[
                    'absolute items-center justify-center rounded-sm bg-background',
                    dim ? 'opacity-25' : '',
                  ].join(' ')}
                  style={{
                    left: labelX(placed.label.x, line.label) - width / 2,
                    top: placed.label.y - EDGE_LABEL_HEIGHT / 2,
                    width,
                    height: EDGE_LABEL_HEIGHT,
                  }}
                >
                  <Text
                    variant="caption"
                    tone={LABEL_TONES[line.tone]}
                    numberOfLines={1}
                  >
                    {line.label}
                  </Text>
                </View>
              );
            })}
            {geometry.nodes.map((placed) => {
              const card = cards.find((item) => item.id === placed.id);
              if (!card) return null;
              return (
                <View
                  key={placed.id}
                  className="absolute"
                  style={{
                    left: placed.x,
                    top: placed.y,
                    width: placed.width,
                    height: placed.height,
                  }}
                >
                  <Card
                    card={card}
                    selected={selected === card.id}
                    dim={near !== undefined && !near.nodes.has(card.id)}
                    onPress={() => onSelect(card.id)}
                  />
                  {card.comments > 0 ? (
                    <View
                      pointerEvents="none"
                      accessibilityLabel={
                        card.comments === 1
                          ? '1 comment'
                          : `${card.comments} comments`
                      }
                      className="absolute -top-1.5 -right-1.5 size-4 items-center justify-center rounded-full border border-border bg-background"
                    >
                      <Icon name="comment" size="small" tone="muted" />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
