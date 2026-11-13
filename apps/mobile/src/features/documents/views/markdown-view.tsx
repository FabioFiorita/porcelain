import type { ReviewRange } from '../../../components/ui/code-range';
import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Box } from '../../../components/ui/box';
import { MarkdownSurface } from '../../../components/ui/markdown-surface';
import { CodeView } from './code-view';
export type MarkdownMode = 'reader' | 'source';

export function markdownModeToggle(mode: MarkdownMode) {
  return mode === 'source'
    ? { label: 'Show rendered', mode: 'reader' as const }
    : { label: 'Show source', mode: 'source' as const };
}

export function MarkdownView({
  initialMode = 'reader',
  ...props
}: Omit<MarkdownContentProps, 'mode'> & { initialMode?: MarkdownMode }) {
  const [mode, setMode] = useState(initialMode);
  const toggle = markdownModeToggle(mode);
  return (
    <Box className="flex-1" surface="background">
      <Box className="flex-row justify-end" padding={2} divider="bottom">
        <Button
          label={toggle.label}
          size="sm"
          variant="plain"
          onPress={() => setMode(toggle.mode)}
        />
      </Box>
      <MarkdownContent {...props} mode={mode} />
    </Box>
  );
}

type MarkdownContentProps = {
  source: string;
  mode: MarkdownMode;
  onLink?: ((url: string) => void) | undefined;
  wrap?: boolean;
  selection?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
};

export function MarkdownContent({
  source,
  mode,
  onLink,
  wrap = true,
  selection,
  onSelect,
}: MarkdownContentProps) {
  return (
    <Box className="flex-1" surface="background">
      {mode === 'source' ? (
        <CodeView
          source={source}
          language="markdown"
          wrap={wrap}
          selection={selection}
          onSelect={onSelect}
        />
      ) : (
        <MarkdownSurface source={source} onLink={onLink} />
      )}
    </Box>
  );
}
