import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { DestinationHeader } from './destination-header';
import { isTablet } from '../shared/navigation/is-tablet';

export function DestinationLayout({
  name,
  title,
  children,
}: {
  name: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Stack
      screenOptions={({ theme }) => ({
        headerBackButtonDisplayMode: 'minimal',
        headerBackVisible: true,
        headerLargeTitleEnabled: false,
        headerTintColor: theme.colors.text,
      })}
      screenLayout={({ children, route }) => (
        <DestinationHeader
          leading={
            route.name !== 'files' &&
            route.name !== 'workspaces' &&
            !(
              isTablet &&
              (route.name === 'review' ||
                route.name === 'history' ||
                route.name === 'settings')
            )
          }
        >
          {children}
        </DestinationHeader>
      )}
    >
      <Stack.Screen
        name={name}
        options={{
          title,
          headerBackVisible: false,
          ...(isTablet && name === 'settings' ? { headerShown: false } : {}),
          ...(!isTablet && name === 'settings'
            ? { headerLargeTitleEnabled: true }
            : {}),
        }}
      />
      {name !== 'settings' ? (
        <Stack.Screen
          name="workspaces"
          options={{
            title: 'Worktrees',
            presentation: 'card',
            headerBackVisible: true,
          }}
        />
      ) : null}
      {children}
    </Stack>
  );
}
