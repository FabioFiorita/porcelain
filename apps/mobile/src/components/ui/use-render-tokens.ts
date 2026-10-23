import { processColor } from 'react-native';
import { useResolveClassNames } from 'uniwind';

export function useRenderTokens() {
  const code = useResolveClassNames('text-ui');
  const caption = useResolveClassNames('text-caption');
  const body = useResolveClassNames('text-base');
  const heading = useResolveClassNames('text-2xl');
  const subheading = useResolveClassNames('text-xl');
  const spacing = useResolveClassNames('p-2');
  const inset = useResolveClassNames('p-1');
  const block = useResolveClassNames('p-3');
  const page = useResolveClassNames('p-4');
  const radius = useResolveClassNames('rounded-lg');
  const foreground = useResolveClassNames('text-foreground');
  const background = useResolveClassNames('bg-background');
  const muted = useResolveClassNames('text-muted-foreground');
  const codeBackground = useResolveClassNames('bg-muted');
  const color = (value: typeof foreground.color) => {
    const resolved = processColor(value);
    return typeof resolved === 'number' ? resolved >>> 0 : 0;
  };
  const tokens = {
    codeSize: code.fontSize,
    captionSize: caption.fontSize,
    bodySize: body.fontSize,
    headingSize: heading.fontSize,
    subheadingSize: subheading.fontSize,
    spacing: spacing.padding,
    inset: inset.padding,
    blockPadding: block.padding,
    pagePadding: page.padding,
    radius: radius.borderRadius,
    foreground: color(foreground.color),
    background: color(background.backgroundColor),
    muted: color(muted.color),
    codeBackground: color(codeBackground.backgroundColor),
  };
  if (
    Object.values(tokens).some(
      (value) =>
        typeof value !== 'number' || !Number.isFinite(value) || value <= 0,
    )
  )
    throw new Error('Renderer design tokens must resolve to positive numbers.');
  return tokens;
}
