import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'
import { Modal, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { parsePairingQr } from '@/features/remote'

export function PairingQrScanner({
  open,
  onClose,
  onScanned,
}: {
  open: boolean
  onClose: () => void
  onScanned: (connectionLink: string) => void
}): React.JSX.Element {
  const [permission, requestPermission] = useCameraPermissions()
  const [paused, setPaused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scanLocked = useRef(false)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (!open || permission !== null) return
    void requestPermission()
  }, [open, permission, requestPermission])

  useEffect(() => {
    if (!open) {
      scanLocked.current = false
      setPaused(false)
      setError(null)
    }
  }, [open])

  const scan = ({ data }: BarcodeScanningResult): void => {
    if (scanLocked.current) return
    scanLocked.current = true
    setPaused(true)
    const result = parsePairingQr(data)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onScanned(result.connectionLink)
    onClose()
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible={open}
    >
      <StatusBar style="light" />
      <View className="flex-1 bg-black" testID="porcelain-pairing-scanner">
        {permission?.granted ? (
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            facing="back"
            className="flex-1"
            onBarcodeScanned={paused ? undefined : scan}
          />
        ) : (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Text className="text-center text-base font-semibold text-white">
              Camera access is needed to scan a pairing code.
            </Text>
            {permission?.canAskAgain === false ? (
              <Text className="text-center text-sm text-white/70">
                Enable Camera for Porcelain in your device settings, then try again.
              </Text>
            ) : (
              <Button variant="secondary" onPress={() => void requestPermission()}>
                <Text>Allow camera</Text>
              </Button>
            )}
          </View>
        )}

        {permission?.granted ? (
          <View
            className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center"
            pointerEvents="box-none"
          >
            <View className="size-64 rounded-3xl border-2 border-white/90" />
          </View>
        ) : null}

        <View
          className="absolute left-0 right-0 top-0 flex-row items-center justify-between px-4"
          style={{ paddingTop: insets.top + 12 }}
        >
          <View className="rounded-full bg-black/60 px-4 py-2">
            <Text className="font-semibold text-white">Scan pairing code</Text>
          </View>
          <Button accessibilityLabel="Close scanner" variant="secondary" onPress={onClose}>
            <Text>Close</Text>
          </Button>
        </View>

        <View
          className="absolute bottom-0 left-0 right-0 items-center gap-3 bg-black/70 px-6 pt-5"
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          <Text className="text-center text-sm text-white/80">
            Point the camera at the QR code in Porcelain’s Share settings.
          </Text>
          {error !== null ? (
            <>
              <Text selectable className="text-center text-sm font-medium text-destructive">
                {error}
              </Text>
              <Button
                variant="secondary"
                onPress={() => {
                  scanLocked.current = false
                  setError(null)
                  setPaused(false)
                }}
              >
                <Text>Scan again</Text>
              </Button>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}
