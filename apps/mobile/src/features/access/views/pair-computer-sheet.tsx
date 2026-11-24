import { Sheet } from '../../../components/ui/sheet';
import { usePairingSheetComputer, usePairingSheetLink } from '../pairing-sheet';
import { PairEnvironmentForm } from './pair-environment-form';

export function PairComputerSheet({
  onClose,
  onScan,
}: {
  onClose: () => void;
  onScan: () => void;
}) {
  const [link, setLink] = usePairingSheetLink();
  const environmentId = usePairingSheetComputer();
  return (
    <Sheet title="Pair a computer">
      <PairEnvironmentForm
        layout="sheet"
        {...(environmentId ? { environmentId } : {})}
        link={link}
        onLinkChange={setLink}
        onClose={onClose}
        onScan={onScan}
      />
    </Sheet>
  );
}
