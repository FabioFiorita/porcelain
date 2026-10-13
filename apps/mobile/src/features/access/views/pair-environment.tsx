import { RNHostView } from '@expo/ui';
import { ScrollView } from 'react-native';
import { Box } from '../../../components/ui/box';
import { PairEnvironmentForm } from './pair-environment-form';

export function PairEnvironment({ onClose }: { onClose: () => void }) {
  return (
    <RNHostView>
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Box paddingX={6} paddingY={8}>
          <PairEnvironmentForm onClose={onClose} />
        </Box>
      </ScrollView>
    </RNHostView>
  );
}
