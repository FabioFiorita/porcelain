import type { ReviewRange } from '../../../components/ui/code-range';
import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Box } from '../../../components/ui/box';
import { HtmlSurface } from '../../../components/ui/html-surface';
import { CodeView } from './code-view';
import { ErrorState } from '../../../components/ui/error-state';

export type HtmlMode = 'preview' | 'source';

export function htmlModeToggle(mode: HtmlMode) {
  return mode === 'source'
    ? { label: 'Show preview', mode: 'preview' as const }
    : { label: 'Show source', mode: 'source' as const };
}

export function HtmlPreview({
  initialMode = 'preview',
  ...props
}: Omit<HtmlContentProps, 'mode'> & { initialMode?: HtmlMode }) {
  const [mode, setMode] = useState(initialMode);
  const toggle = htmlModeToggle(mode);
  return (
    <Box className="flex-1" surface="background">
      <Box className="flex-row justify-end" padding={2} divider="bottom">
        <Button
          label={toggle.label}
          variant="plain"
          size="sm"
          onPress={() => setMode(toggle.mode)}
        />
      </Box>
      <HtmlContent {...props} mode={mode} />
    </Box>
  );
}

type HtmlContentProps = {
  html: string;
  mode: HtmlMode;
  onLink?: ((url: string) => void) | undefined;
  wrap?: boolean;
  selection?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
};

export function HtmlContent(props: HtmlContentProps) {
  return (
    <Box className="flex-1" surface="background">
      <HtmlDocument key={props.html} {...props} />
    </Box>
  );
}

function HtmlDocument({
  html,
  mode,
  onLink,
  wrap = true,
  selection,
  onSelect,
}: HtmlContentProps) {
  const [error, setError] = useState('');
  if (mode === 'source')
    return (
      <CodeView
        source={html}
        language="html"
        wrap={wrap}
        selection={selection}
        onSelect={onSelect}
      />
    );
  if (error) return <ErrorState message={error} />;
  return <HtmlSurface html={html} onLink={onLink} onError={setError} />;
}
