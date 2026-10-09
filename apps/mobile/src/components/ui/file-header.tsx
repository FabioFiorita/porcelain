import type { ReactNode } from 'react';
import { View } from 'react-native';
import { FilePath } from './file-path';
import { Badge } from './badge';
import { Text } from './text';

export function FileHeader({
  path,
  status,
  additions,
  deletions,
  reviewed = false,
  actions,
}: {
  path: string;
  status?: string;
  additions?: number;
  deletions?: number;
  reviewed?: boolean;
  actions?: ReactNode;
}) {
  return (
    <View className="gap-3 border-b border-border bg-background px-4 py-3">
      <FilePath path={path} compact />
      <View className="flex-row flex-wrap items-center gap-2">
        {status ? <Badge label={status} variant="secondary" /> : null}
        {additions !== undefined ? (
          <Text variant="caption">+{additions}</Text>
        ) : null}
        {deletions !== undefined ? (
          <Text variant="caption" tone="destructive">
            −{deletions}
          </Text>
        ) : null}
        {reviewed ? <Badge label="Reviewed" variant="outline" /> : null}
        {actions}
      </View>
    </View>
  );
}
