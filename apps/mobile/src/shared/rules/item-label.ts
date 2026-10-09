export function itemAccessibilityLabel({
  title,
  description,
  accessibilityLabel,
  hasAdditionalContent,
}: {
  title: string;
  description?: string | undefined;
  accessibilityLabel?: string | undefined;
  hasAdditionalContent: boolean;
}): string | undefined {
  return (
    accessibilityLabel ??
    (hasAdditionalContent
      ? undefined
      : [title, description].filter(Boolean).join('. '))
  );
}
