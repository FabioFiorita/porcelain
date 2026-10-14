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
  documentToolbar = false,
}: {
  path: string;
  status?: string;
  additions?: number;
  deletions?: number;
  reviewed?: boolean;
  actions?: ReactNode;
  documentToolbar?: boolean | undefined;
}) {
  const metadata =
    status || additions !== undefined || deletions !== undefined || reviewed;
  return (
    <View className="gap-3 border-b border-border bg-background px-4 py-3">
      {documentToolbar ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <View className="min-w-0 flex-1">
            <FilePath path={path} />
          </View>
          {actions}
        </View>
      ) : (
        <FilePath path={path} compact />
      )}
      {!documentToolbar || metadata ? (
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
          {documentToolbar ? null : actions}
        </View>
      ) : null}
    </View>
  );
}
