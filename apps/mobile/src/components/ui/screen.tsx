import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

type ScreenProps =
  | {
      layout: 'scroll';
      children: ReactNode;
      accessibilityLabel?: string;
      testID?: string;
    }
  | {
      layout: 'fixed';
      children: ReactNode;
      testID?: string;
    };

export function Screen(props: ScreenProps) {
  if (props.layout === 'fixed')
    return (
      <View
        className="flex-1 bg-background"
        collapsable={false}
        testID={props.testID}
      >
        <Stack.Screen options={{ headerTransparent: false }} />
        {props.children}
      </View>
    );
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="grow pb-8"
      keyboardShouldPersistTaps="handled"
      accessibilityLabel={props.accessibilityLabel}
      testID={props.testID}
    >
      {props.children}
    </ScrollView>
  );
}
