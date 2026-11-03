import { CameraView } from 'expo-camera';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';
import { IconButton } from './icon-button';
import { Text } from './text';

type QrScannerProps = {
  onClose: () => void;
} & (
  | {
      hint: string;
      message?: string | undefined;
      onScan: ((text: string) => void) | undefined;
      onUnavailable: (message: string) => void;
    }
  | { blocked: ReactNode }
);

export function QrScanner(props: QrScannerProps) {
  const scanning = !('blocked' in props);
  return (
    <View className="flex-1 bg-background" collapsable={false}>
      {scanning ? (
        <CameraView
          testID="qr-scanner"
          accessibilityLabel="Camera"
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={
            props.onScan === undefined
              ? undefined
              : ({ data }) => props.onScan?.(data)
          }
          onMountError={(error) => props.onUnavailable(error.message)}
        />
      ) : null}
      <SafeAreaView
        edges={{ top: true, bottom: true }}
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
      >
        <View className="flex-row justify-end p-4" pointerEvents="box-none">
          <IconButton
            icon="close"
            variant={scanning ? 'filled' : 'plain'}
            accessibilityLabel="Close"
            onPress={props.onClose}
          />
        </View>
        <View className="flex-1 justify-end" pointerEvents="box-none">
          {scanning ? (
            <View className="m-4 gap-2 self-center rounded-xl bg-background/90 px-4 py-3">
              <Text variant="secondary" className="text-center">
                {props.hint}
              </Text>
              {props.message === undefined ? null : (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  variant="secondary"
                  tone="destructive"
                  className="text-center"
                >
                  {props.message}
                </Text>
              )}
            </View>
          ) : (
            props.blocked
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
