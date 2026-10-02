import { Text, View } from 'react-native';

export function WorktreeEmpty({ title }: { title: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6 py-8">
      <View className="w-full max-w-sm items-center gap-2">
        <Text
          accessibilityRole="header"
          className="text-xl font-semibold text-foreground"
        >
          {title}
        </Text>
        <Text className="text-center text-sm leading-6 text-muted-foreground">
          Select a worktree to continue.
        </Text>
      </View>
    </View>
  );
}
