import { DestinationLayout } from '../../shell/destination-layout';
import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'files' };

function FilesLayout() {
  return (
    <DestinationLayout name="files" title="Files">
      <Stack.Screen
        name="retained-review/[reviewId]"
        options={{ title: 'Published review' }}
      />
    </DestinationLayout>
  );
}

export { FilesLayout as default };
