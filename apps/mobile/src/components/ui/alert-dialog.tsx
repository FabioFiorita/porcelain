import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { BottomSheet, RNHostView } from '@expo/ui';
import { Box } from './box';
import { Text } from './text';
import { Button } from './button';

export function AlertDialog({
  open,
  title,
  description,
  children,
  disabled,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  children?: ReactNode;
  disabled: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <BottomSheet
      isPresented={open}
      onDismiss={onCancel}
      contentPadding={0}
      snapPoints={['full']}
    >
      <RNHostView>
        <Box paddingX={6} paddingY={8}>
          <Box className="w-full" surface="background" padding={4} gap={4}>
            <Text variant="subheading">{title}</Text>
            <ScrollView>
              <Text>{description}</Text>
              {children}
            </ScrollView>
            <Box className="flex-row justify-end" gap={2}>
              <Button
                label="Cancel"
                variant="outline"
                disabled={pending}
                onPress={onCancel}
              />
              <Button
                label="Archive review"
                variant="destructive"
                disabled={disabled}
                pending={pending}
                onPress={onConfirm}
              />
            </Box>
          </Box>
        </Box>
      </RNHostView>
    </BottomSheet>
  );
}
