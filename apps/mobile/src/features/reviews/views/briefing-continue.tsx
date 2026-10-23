import { SafeAreaView } from 'react-native-screens/experimental';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';

export function BriefingContinue({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <SafeAreaView
      edges={{ bottom: true }}
      insetType="system"
      style={{ flex: 0 }}
    >
      <Box paddingX={4} paddingY={3} surface="background">
        <Button label={label} onPress={onPress} />
      </Box>
    </SafeAreaView>
  );
}
