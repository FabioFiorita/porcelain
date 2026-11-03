import { openSettings } from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Empty } from '../../../components/ui/empty';
import { Loading } from '../../../components/ui/loading';
import { QrScanner } from '../../../components/ui/qr-scanner';
import { useCameraPermission } from '../queries/camera-permission';
import { scannedPairingLink } from '../rules/pairing-link-intake';
import { useOfferPairingLink } from '../pairing-sheet';

export function ScanPairingLinkScreen() {
  const router = useRouter();
  const { permission, request } = useCameraPermission();
  const offer = useOfferPairingLink();
  const [message, setMessage] = useState<string>();
  const close = () => router.back();

  if (permission === undefined)
    return <QrScanner onClose={close} blocked={<Loading />} />;
  if (!permission.granted)
    return (
      <QrScanner
        onClose={close}
        blocked={
          <Empty
            icon="camera"
            title="Allow camera access"
            description="Porcelain uses the camera only to read the pairing QR code your computer shows. You can close this and paste the link instead."
            action={
              permission.canAskAgain
                ? {
                    label: 'Allow camera',
                    onPress: request,
                  }
                : {
                    label: 'Open Settings',
                    onPress: () => void openSettings(),
                  }
            }
          />
        }
      />
    );
  return (
    <QrScanner
      hint="Point the camera at the pairing QR code on your computer."
      message={message}
      onClose={close}
      onUnavailable={setMessage}
      onScan={(text) => {
        const link = scannedPairingLink(text);
        if (link === undefined) {
          setMessage('This QR code is not a Porcelain pairing link.');
          return;
        }
        offer(link);
        router.dismissTo('/pair-computer');
      }}
    />
  );
}
