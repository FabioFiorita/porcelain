import { DestinationLayout } from '../../shell/destination-layout';
import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'files' };

function FilesLayout() {
  return (
    <DestinationLayout name="files" title="Files">
      <Stack.Screen
        name="file-edit"
        options={{
          presentation: 'formSheet',
          title: 'Edit file',
          sheetAllowedDetents: [1],
          sheetGrabberVisible: true,
        }}
      />
    </DestinationLayout>
  );
}

export { FilesLayout as default };
