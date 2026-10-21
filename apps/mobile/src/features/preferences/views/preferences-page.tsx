import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '../../../components/ui/box';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { usePreferences } from '../store';

export function PreferencesPage({
  children,
}: {
  children: (
    settings: Pick<
      ReturnType<typeof usePreferences>,
      'preferences' | 'setPreferences'
    > & { disabled: boolean },
  ) => ReactNode;
}) {
  const { preferences, status, error, read, setPreferences } = usePreferences();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Box
        className="w-full max-w-2xl self-center"
        gap={6}
        paddingX={6}
        paddingY={8}
      >
        {status === 'loading' ? (
          <Loading label="Reading saved preferences…" />
        ) : null}
        {error ? (
          <ErrorState
            message={error}
            retry={{
              label: 'Read saved preferences again',
              onPress: () => read(undefined),
            }}
          />
        ) : null}
        {children({
          preferences,
          setPreferences,
          disabled: status !== 'ready',
        })}
      </Box>
    </ScrollView>
  );
}
