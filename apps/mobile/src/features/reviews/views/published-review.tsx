import { Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import type { useReview } from '../queries/review';

export function PublishedReview({
  review,
}: {
  review: NonNullable<ReturnType<typeof useReview>['published']>;
}) {
  const section = useResolveClassNames('gap-3');
  const card = useResolveClassNames(
    'gap-3 rounded-lg border border-border bg-card p-3',
  );
  const heading = useResolveClassNames('text-sm font-medium text-foreground');
  const title = useResolveClassNames(
    'text-base font-semibold text-card-foreground',
  );
  const text = useResolveClassNames('text-sm leading-6 text-card-foreground');
  const stepStyle = useResolveClassNames('gap-1 border-l border-border pl-3');
  const metadata = useResolveClassNames(
    'text-xs leading-5 text-muted-foreground',
  );
  return (
    <View style={section}>
      <Text accessibilityRole="header" style={heading}>
        Published review
      </Text>
      {review.layers.map((layer) => (
        <View key={layer.id} style={card}>
          <Text accessibilityRole="header" style={title}>
            {layer.title}
          </Text>
          <Text selectable style={text}>
            {layer.summary}
          </Text>
          {layer.steps.map((step) => (
            <View key={step.id} style={stepStyle}>
              <Text style={heading}>{step.title}</Text>
              <Text selectable style={text}>
                {step.text}
              </Text>
              <Text style={metadata}>
                {step.pointer.path} · {step.pointer.startLine}–
                {step.pointer.endLine}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
