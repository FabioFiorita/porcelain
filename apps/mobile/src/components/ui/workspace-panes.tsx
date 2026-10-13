import { useState, type ReactNode } from 'react';
import { Box } from './box';
import { Separator } from './separator';

export function WorkspacePanes({
  navigation,
  header,
  children,
  navigationVisible,
  onNavigationVisibleChange,
}: {
  navigation: (showContent: () => void) => ReactNode;
  header: (showContent: () => void) => ReactNode;
  children: ReactNode;
  navigationVisible: boolean;
  onNavigationVisibleChange: (visible: boolean) => void;
}) {
  const [width, setWidth] = useState(0);
  const wide = width >= 700;
  const navigationClass = wide ? 'w-80 shrink-0' : 'flex-1';
  const showContent = () => {
    if (!wide) onNavigationVisibleChange(false);
  };
  return (
    <Box
      className="min-w-0 flex-1"
      surface="background"
      onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}
    >
      {header(showContent)}
      <Box className="min-w-0 flex-1 flex-row">
        <Box
          className={!wide && navigationVisible ? 'hidden' : 'min-w-0 flex-1'}
        >
          {children}
        </Box>
        {wide && navigationVisible ? (
          <Separator orientation="vertical" />
        ) : null}
        <Box className={!navigationVisible ? 'hidden' : navigationClass}>
          {navigation(showContent)}
        </Box>
      </Box>
    </Box>
  );
}
