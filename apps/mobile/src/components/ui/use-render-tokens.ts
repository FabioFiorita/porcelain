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
  };
  if (
    Object.values(tokens).some(
      (value) =>
        typeof value !== 'number' || !Number.isFinite(value) || value <= 0,
    )
  )
    throw new Error('Renderer design tokens must resolve to positive numbers.');
  return JSON.stringify(tokens);
}
