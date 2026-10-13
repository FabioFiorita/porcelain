import { useState, type ReactNode } from 'react';
import { Box } from './box';
import { Button } from './button';
import { Separator } from './separator';

export function WorkspacePanes({
  navigation,
  navigationLabel,
  hasSelection,
  children,
}: {
  navigation: (showContent: () => void) => ReactNode;
  navigationLabel: string;
  hasSelection: boolean;
  children: ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const [navigationVisible, setNavigationVisible] = useState(false);
  const wide = width >= 700;
  const showNavigation = !wide && (!hasSelection || navigationVisible);
  const navigationClass = wide ? 'w-64 shrink-0' : 'flex-1';
  return (
    <Box
      className="min-w-0 flex-1"
      surface="background"
      onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}
    >
      {!wide && hasSelection ? (
        <Box className="items-start" paddingX={4} paddingY={2} divider="bottom">
          <Button
            variant="ghost"
            label={showNavigation ? 'Show open document' : navigationLabel}
            onPress={() => setNavigationVisible(!showNavigation)}
          />
        </Box>
      ) : null}
      <Box className="min-w-0 flex-1 flex-row">
        <Box className={!wide && !showNavigation ? 'hidden' : navigationClass}>
          {navigation(() => setNavigationVisible(false))}
        </Box>
        {wide ? <Separator orientation="vertical" /> : null}
        <Box className={showNavigation ? 'hidden' : 'min-w-0 flex-1'}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
